// src/ai/api.ts - Hybrid approach API
import {
  CafeInfo,
  DatasetAssessment,
  DayOfWeek,
  PredictionRequest,
  PredictionResponse,
  TrainingResult,
  Weather,
} from "./types";

const BASE_URL = "https://loveovers-backend.onrender.com";

const postFormData = async <T>(
  path: string,
  formData: FormData,
): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
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
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

// Upload and assess dataset (3-layer approach)
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

// Train model with optional user corrections
export const trainModel = async (
  fileUri: string,
  fileName: string,
  cafeName: string,
  cafeId?: string,
  userCorrections?: Record<string, string>, // { "original_col": "standard_col" }
): Promise<TrainingResult> => {
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: "text/csv",
  } as any);
  formData.append("cafe_name", cafeName);
  if (cafeId) formData.append("cafe_id", cafeId);
  if (userCorrections) {
    formData.append("user_corrections", JSON.stringify(userCorrections));
  }

  return postFormData<TrainingResult>("/train", formData);
};

// Predict for a specific cafe
export const predictForCafe = async (
  data: PredictionRequest,
): Promise<PredictionResponse> => {
  return postJson<PredictionResponse>("/predict", data);
};

// Batch predict full day
export const batchPredict = async (
  cafeId: string,
  day: DayOfWeek,
  weather: Weather,
  discountPct: number = 0,
) => {
  return postJson("/batch-predict", {
    cafe_id: cafeId,
    day_of_week: day,
    weather,
    discount_pct: discountPct,
  });
};

// List all trained cafes
export const listCafes = async (): Promise<{ cafes: CafeInfo[] }> => {
  return getJson<{ cafes: CafeInfo[] }>("/cafes");
};

// Get cafe info
export const getCafeInfo = async (cafeId: string) => {
  return getJson(`/cafe/${cafeId}`);
};
