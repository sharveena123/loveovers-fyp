// src/ai/api.ts - v4.2 Ollama
import {
  AssessmentUpdateResponse,
  BatchPredictionResponse,
  CafeInfo,
  DatasetAssessment,
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

export const getCafeInfo = async (cafeId: string) => {
  return getJson(`/cafe/${cafeId}`);
};
