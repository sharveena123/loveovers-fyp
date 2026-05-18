// src/ai/types.ts - v4.2 Ollama

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

export type EditableMappingEntry = {
  original_column: string;
  current_mapping: string;
  ai_suggested_mapping: string;
  source: "rule" | "llm" | "unmapped";
  confidence: "high" | "medium" | "low";
  editable: boolean;
  user_modified?: boolean;
  options: string[];
};

export type LayerBreakdown = {
  rule_based_mapped: number;
  llm_mapped: number;
  needs_confirmation: number;
};

export type DatasetAssessment = {
  assessment_id: string;
  cafe_name: string;
  total_rows: number;
  total_columns: number;
  original_columns: string[];
  editable_mapping: EditableMappingEntry[];
  detected_mapping: Record<string, string>;
  llm_assisted_mapping: Record<string, string>;
  needs_confirmation: NeedsConfirmation[];
  missing_required: string[];
  missing_optional: string[];
  data_quality_issues: string[];
  suggestions: string[];
  usable: boolean;
  confidence: string;
  layer_breakdown: LayerBreakdown;
  message?: string;
  diagnostic?: string;
  ai_engine?: string;
};

export type NeedsConfirmation = {
  column: string;
  suggested_mapping: string;
  confidence: string;
  options: string[];
};

export type TrainingResult = {
  cafe_id: string;
  cafe_name: string;
  status: string;
  model: string;
  rows_used: number;
  items: string[];
  mae: number;
  r2: number;
  cv_mae: number;
  confidence: string;
  detected_mapping: Record<string, string>;
  top_features?: Record<string, number>;
  message: string;
  model_breakdown?: {
    xgboost: { mae: number; r2: number };
    lightgbm: { mae: number; r2: number };
    catboost: { mae: number; r2: number };
    ensemble: { mae: number; r2: number };
  };
  best_individual?: "xgboost" | "lightgbm" | "catboost";
};

export type PredictionRequest = {
  cafe_id: string;
  item: string;
  day_of_week: DayOfWeek;
  weather: Weather;
  price: number;
  discount_pct?: number;
  produced_qty?: number;
  date?: string;
  sold_qty_lag_1?: number;
  sold_qty_lag_7?: number;
  sold_qty_lag_14?: number;
  sold_qty_roll_7?: number;
  item_avg_sales?: number;
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
  cv_mae: number;
  training_size: number;
};

export type BatchPredictionItem = {
  item: string;
  base_predicted_sales: number;
  predicted_sales: number;
  recommended_production: number;
  expected_surplus: number;
};

export type BatchPredictionResponse = {
  cafe_id: string;
  cafe_name: string;
  day: string;
  weather: string;
  discount_pct: number;
  predictions: BatchPredictionItem[];
  total_base_sales: number;
  total_predicted_sales: number;
  total_recommended_production: number;
  total_expected_surplus: number;
};

export type CafeInfo = {
  cafe_id: string;
  cafe_name: string;
  items: string[];
  training_rows: number;
  r2: number;
  cv_mae: number;
  model: string;
};

export type AssessmentUpdateResponse = {
  assessment_id: string;
  applied_changes: {
    column: string;
    old_mapping: string;
    new_mapping: string;
  }[];
  rejected_changes: {
    column: string;
    reason: string;
  }[];
  current_mapping: Record<string, string>;
  missing_required: string[];
  missing_optional: string[];
  usable: boolean;
  editable_mapping: EditableMappingEntry[];
  message: string;
};

// ─── Dataset analytics (training CSV) ─────────────────────

export type DatasetRow = Record<string, string | number | null | undefined>;

export type CafeDatasetResponse = {
  cafe_id: string;
  cafe_name: string;
  records: DatasetRow[];
  summary?: {
    total_rows?: number;
    items?: string[];
    date_start?: string;
    date_end?: string;
    r2?: number;
  };
};

export type DailySalesPoint = {
  label: string;
  date: string;
  sales: number;
  orders: number;
  sold: number;
  waste: number;
};

export type ItemWasteRow = {
  itemName: string;
  sold: number;
  waste: number;
  produced: number;
  wastePercentage: number;
  revenue: number;
};

export type ScatterPoint = {
  item: string;
  prepared: number;
  sold: number;
};

export type HeatmapCell = {
  day: string;
  time: string;
  orders: number;
};

export type FunnelStage = {
  stage: string;
  count: number;
  color: string;
};

export type SurplusPoint = {
  label: string;
  surplus: number;
  sold: number;
};

export type ItemForecast = {
  item: string;
  predicted: number;
  recommended: number;
};

export type DatasetAnalyticsBundle = {
  cafeId: string;
  cafeName: string;
  dataSource: "dataset" | "firebase";
  trainingRows: number;
  modelAccuracy: number;
  dateRange: { start: string; end: string };
  itemForecasts?: ItemForecast[];
  kpis: {
    totalSales: number;
    itemsSold: number;
    wastePercentage: number;
    revenueSaved: number;
    topProduct: string;
    conversionRate: number;
    averageOrderValue: number;
  };
  salesOverTime: DailySalesPoint[];
  topSellingItems: ItemWasteRow[];
  wasteAnalysis: ItemWasteRow[];
  revenueByCategory: { label: string; value: number; color: string }[];
  actualVsPredicted: { label: string; actual: number; predicted: number }[];
  surplusTrend: SurplusPoint[];
  scatterData: ScatterPoint[];
  heatmap: HeatmapCell[];
  funnel: FunnelStage[];
  insights: string[];
};
