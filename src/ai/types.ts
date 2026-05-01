// src/ai/types.ts - Hybrid approach with confirmation

export type BakeryItem = string;

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";
export type Weather = "Sunny" | "Cloudy" | "Rainy" | "Unknown";

// Column that needs user confirmation
export type NeedsConfirmation = {
  column: string;
  suggested_mapping: string;
  confidence: string;
  options: string[];
};

// Layer breakdown from assessment
export type LayerBreakdown = {
  rule_based_mapped: number;
  llm_mapped: number;
  needs_confirmation: number;
};

export type DatasetAssessment = {
  cafe_name: string;
  total_rows: number;
  total_columns: number;
  original_columns: string[];
  detected_mapping: Record<string, string>;
  llm_assisted_mapping: Record<string, string>;
  needs_confirmation: NeedsConfirmation[];
  missing_required: string[];
  missing_optional: string[];
  data_quality_issues: string[];
  suggestions: string[];
  usable: boolean;
  confidence: string; // "high" | "medium" | "low"
  layer_breakdown: LayerBreakdown;
};

export type TrainingResult = {
  cafe_id: string;
  cafe_name: string;
  status: string;
  rows_used: number;
  items: string[];
  mae: number;
  r2: number;
  confidence: string;
  detected_mapping: Record<string, string>;
  message: string;
};

export type PredictionRequest = {
  cafe_id: string;
  item: string;
  day_of_week: DayOfWeek;
  weather: Weather;
  price: number;
  discount_pct?: number;
  produced_qty?: number;
};

export type PredictionResponse = {
  cafe_id: string;
  cafe_name: string;
  item: string;
  day_of_week: DayOfWeek;
  weather: Weather;
  discount_pct: number;
  base_predicted_sales: number;
  predicted_sales: number;
  recommended_production: number;
  produced_qty: number;
  expected_surplus: number;
  surplus_rate: number;
  price_rm: number;
  base_revenue_rm: number;
  discounted_revenue_rm: number;
  revenue_impact: number;
  is_weekend: boolean;
  model_accuracy: number;
  training_size: number;
};

export type CafeInfo = {
  cafe_id: string;
  cafe_name: string;
  items: string[];
  training_rows: number;
  r2: number;
};
