// src/ai/api.ts - v4.2 Ollama
import {
  AssessmentUpdateResponse,
  BatchPredictionResponse,
  CafeDatasetApiResponse,
  CafeDatasetResponse,
  CafeInfo,
  ClassifyFoodResponse,
  DatasetAssessment,
  DatasetRow,
  DayOfWeek,
  PredictionRequest,
  PredictionResponse,
  RecordDailySalesRequest,
  RecordDailySalesResponse,
  RetrainResult,
  TrainingResult,
} from "./types";
import { parseClassifyFoodResponse } from "@/src/utils/foodClassification";

/** Must be reachable from the phone (same LAN IP as Metro, not localhost). */
export const AI_API_BASE_URL =
  process.env.EXPO_PUBLIC_AI_API_BASE_URL ?? "http://192.168.100.70:5000";

const BASE_URL = AI_API_BASE_URL;

const postFormData = async <T>(
  path: string,
  formData: FormData,
): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request failed with status ${response.status}: ${errorText}`,
    );
  }

  return response.json() as Promise<T>;
};

const postJson = async <T>(path: string, data: unknown): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request failed with status ${response.status}: ${errorText}`,
    );
  }

  return response.json() as Promise<T>;
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request failed with status ${response.status}: ${errorText}`,
    );
  }

  return response.json() as Promise<T>;
};

// ─── Assessment ────────────────────────────────────────────

export const assessDataset = async (
  fileUri: string,
  fileName: string,
  cafeName: string,
): Promise<DatasetAssessment> => {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: "text/csv",
  } as any);
  formData.append("cafe_name", cafeName);

  return postFormData<DatasetAssessment>("/assess", formData);
};

export const getAssessment = async (
  assessmentId: string,
): Promise<DatasetAssessment> => {
  return getJson<DatasetAssessment>(`/assessment/${assessmentId}`);
};

export const updateAssessment = async (
  assessmentId: string,
  mappingChanges: Record<string, string>,
): Promise<AssessmentUpdateResponse> => {
  return postJson<AssessmentUpdateResponse>(
    `/assessment/${assessmentId}/update`,
    { mapping_changes: mappingChanges },
  );
};

// ─── Training ──────────────────────────────────────────────

/** v4.2: Train using assessment_id (Ollama backend) */
export const trainModel = async (
  fileUri: string,
  fileName: string,
  cafeName: string,
  assessmentId: string,
  cafeId?: string,
): Promise<TrainingResult> => {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: "text/csv",
  } as any);
  formData.append("cafe_name", cafeName);
  formData.append("assessment_id", assessmentId);
  if (cafeId) formData.append("cafe_id", cafeId);

  return postFormData<TrainingResult>("/train", formData);
};

// ─── Prediction ────────────────────────────────────────────

const DAY_INDEX: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const toLocalIso = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Date (YYYY-MM-DD) of the next occurrence of `day`, today included.
 * The backend derives day_of_week_num and all DOW-aware lag features from
 * the `date` field — sending today's date for every selected day would make
 * all weekdays return identical predictions.
 */
export const nextDateForDay = (day: DayOfWeek): string => {
  const now = new Date();
  const diff = (DAY_INDEX[day] - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return toLocalIso(target);
};

export const predictForCafe = async (
  data: PredictionRequest,
): Promise<PredictionResponse> => {
  return postJson<PredictionResponse>("/predict", {
    ...data,
    date: data.date || nextDateForDay(data.day_of_week),
  });
};

export const batchPredict = async (
  cafeId: string,
  day: DayOfWeek,
  date?: string,
): Promise<BatchPredictionResponse> => {
  return postJson<BatchPredictionResponse>("/batch-predict", {
    cafe_id: cafeId,
    day_of_week: day,
    date: date || nextDateForDay(day),
  });
};

// ─── Info ─────────────────────────────────────────────────

export const listCafes = async (): Promise<{ cafes: CafeInfo[] }> => {
  return getJson<{ cafes: CafeInfo[] }>("/cafes");
};

export const getCafeInfo = async (cafeId: string): Promise<CafeInfo> => {
  return getJson<CafeInfo>(`/cafe/${cafeId}`);
};

const normalizeDatasetRecords = (payload: unknown): DatasetRow[] => {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const raw =
    obj.records ??
    obj.data ??
    obj.rows ??
    obj.dataset ??
    (Array.isArray(payload) ? payload : null);
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object") as DatasetRow[];
};

const mapRecentSalesToRecords = (rows: DatasetRow[]): DatasetRow[] =>
  rows.map((row) => ({
    date: row.date ?? row.sale_date,
    item: row.item ?? row.product ?? row.item_name,
    sold_qty: row.sold_qty ?? row.sold ?? row.quantity,
    produced_qty: row.produced_qty ?? row.produced,
    price: row.price,
    day_of_week: row.day_of_week,
    weather: row.weather,
    discount_pct: row.discount_pct ?? row.discount,
    source: row.source,
  }));

/** Fetch stored sales history from the AI backend. */
export const getCafeDataset = async (
  cafeId: string,
): Promise<CafeDatasetResponse | null> => {
  try {
    const res = await getJson<CafeDatasetApiResponse & Record<string, unknown>>(
      `/cafe/${cafeId}/dataset`,
    );
    let recent = mapRecentSalesToRecords(res.recent_sales || []);
    if (!recent.length) {
      recent = normalizeDatasetRecords(res);
    }
    const summary = res.summary ?? { total_rows: recent.length };
    const totalRows = summary.total_rows ?? recent.length;

    return {
      cafe_id: res.cafe_id ?? cafeId,
      cafe_name: res.cafe_name ?? cafeId,
      records: recent,
      summary: {
        total_rows: totalRows,
        items: res.items,
        date_start: undefined,
        date_end: undefined,
      },
    };
  } catch {
    // fall through to legacy paths
  }

  const paths = [
    `/cafe/${cafeId}/data`,
    `/cafe/${cafeId}/records`,
    `/cafe/${cafeId}/analytics`,
  ];

  for (const path of paths) {
    try {
      const res = await getJson<Record<string, unknown>>(path);
      const records = normalizeDatasetRecords(res);
      if (records.length === 0) continue;

      const summary = (res.summary as CafeDatasetResponse["summary"]) ?? {
        total_rows: records.length,
        r2: typeof res.r2 === "number" ? res.r2 : undefined,
      };

      return {
        cafe_id: String(res.cafe_id ?? cafeId),
        cafe_name: String(res.cafe_name ?? res.name ?? cafeId),
        records,
        summary,
      };
    } catch {
      // try next endpoint
    }
  }

  return null;
};

/** Record manual daily sales (merges with uploaded CSV history). */
export const recordDailySales = async (
  cafeId: string,
  payload: RecordDailySalesRequest,
): Promise<RecordDailySalesResponse> => {
  return postJson<RecordDailySalesResponse>(
    `/cafe/${cafeId}/daily-sales`,
    payload,
  );
};

/** Retrain model from all sales stored in the backend database. */
export const retrainCafe = async (cafeId: string): Promise<RetrainResult> => {
  return postJson<RetrainResult>(`/cafe/${cafeId}/retrain`, {});
};

// ─── Food category classification ─────────────────────────

export const CLASSIFY_FOOD_URL = `${AI_API_BASE_URL}/classify-food`;

/** POST /classify-food — multipart upload; do not set Content-Type (RN sets boundary). */
export const classifyFoodImage = async (
  imageUri: string,
  options?: { debug?: boolean },
): Promise<ClassifyFoodResponse> => {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "food.jpg",
  } as any);

  const url = options?.debug
    ? `${CLASSIFY_FOOD_URL}?debug=1`
    : CLASSIFY_FOOD_URL;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => ({}))) as ClassifyFoodResponse & {
    error?: string;
  };

  if (!response.ok) {
    console.error("classify-food failed", {
      url,
      status: response.status,
      data,
    });
    throw new Error(
      data.error || String(response.status) || "Classification failed",
    );
  }

  return parseClassifyFoodResponse(
    data as Record<string, unknown>,
  ) as ClassifyFoodResponse;
};
