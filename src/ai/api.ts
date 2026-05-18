// src/ai/api.ts - v4.2 Ollama
import {
  AssessmentUpdateResponse,
  BatchPredictionResponse,
  CafeDatasetResponse,
  CafeInfo,
  DatasetAssessment,
  DatasetRow,
  DayOfWeek,
  PredictionRequest,
  PredictionResponse,
  TrainingResult,
  Weather,
} from "./types";

const BASE_URL = "http://192.168.100.70:5000";

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

export const predictForCafe = async (
  data: PredictionRequest,
): Promise<PredictionResponse> => {
  return postJson<PredictionResponse>("/predict", data);
};

export const batchPredict = async (
  cafeId: string,
  day: DayOfWeek,
  weather: Weather,
  discountPct: number = 0,
  date?: string,
): Promise<BatchPredictionResponse> => {
  return postJson<BatchPredictionResponse>("/batch-predict", {
    cafe_id: cafeId,
    day_of_week: day,
    weather,
    discount_pct: discountPct,
    date: date || new Date().toISOString().split("T")[0],
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

/** Fetch training CSV rows from the AI backend (tries common paths). */
export const getCafeDataset = async (
  cafeId: string,
): Promise<CafeDatasetResponse | null> => {
  const paths = [
    `/cafe/${cafeId}/data`,
    `/cafe/${cafeId}/records`,
    `/cafe/${cafeId}/dataset`,
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

  try {
    const cafe = await getCafeInfo(cafeId);
    const records = normalizeDatasetRecords(cafe as unknown as Record<string, unknown>);
    if (records.length > 0) {
      return {
        cafe_id: cafe.cafe_id,
        cafe_name: cafe.cafe_name,
        records,
        summary: { total_rows: records.length, r2: cafe.r2 },
      };
    }
  } catch {
    // no embedded records on cafe info
  }

  return null;
};
