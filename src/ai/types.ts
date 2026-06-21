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
  created_at?: string;
  total_rows: number;
  total_columns: number;
  original_columns: string[];
  editable_mapping: EditableMappingEntry[];
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
  cv_r2: number;
  accuracy_pct: number;
  confidence: string;
  detected_mapping: Record<string, string>;
  top_features?: Record<string, number>;
  persisted?: boolean;
  dataset_summary?: DatasetSummary;
  message: string;
};

export type PredictionRequest = {
  cafe_id: string;
  item: string;
  day_of_week: DayOfWeek;
  price?: number;
  produced_qty?: number;
  date?: string;
  /** Optional real recent-sales overrides — beat the DOW-aware averages. */
  sold_qty_lag_1?: number;
  sold_qty_lag_2?: number;
  sold_qty_lag_3?: number;
  sold_qty_lag_7?: number;
  sold_qty_lag_14?: number;
  sold_qty_lag_21?: number;
  sold_qty_lag_28?: number;
  sold_qty_roll_3?: number;
  sold_qty_roll_7?: number;
  sold_qty_roll_14?: number;
  sold_qty_roll_30?: number;
  item_avg_sales?: number;
  item_dow_avg?: number;
};

export type PredictionResponse = {
  cafe_id: string;
  cafe_name: string;
  item: string;
  day_of_week: DayOfWeek;
  predicted_sales: number;
  recommended_production: number;
  produced_qty: number;
  expected_surplus: number;
  surplus_rate: number;
  price_rm: number;
  revenue_rm: number;
  is_weekend: boolean;
  model_accuracy: number;
  cv_mae: number;
  training_size: number;
};

export type BatchPredictionItem = {
  item: string;
  predicted_sales: number;
  recommended_production: number;
  expected_surplus: number;
};

export type BatchPredictionResponse = {
  cafe_id: string;
  cafe_name: string;
  day: string;
  date: string;
  predictions: BatchPredictionItem[];
  total_predicted_sales: number;
  total_recommended_production: number;
  total_expected_surplus: number;
};

export type CafeInfo = {
  cafe_id: string;
  cafe_name: string;
  items: string[];
  training_rows: number;
  mae?: number;
  r2?: number;
  cv_mae?: number;
  model?: string;
  model_loaded?: boolean;
  dataset_summary?: DatasetSummary;
  accuracy_pct?: number;
  trained_at?: string;
  last_trained_at?: string;
  dataset_days?: number;
  manual_entries?: number;
  detected_mapping?: Record<string, string>;
  top_features?: Record<string, number>;
  persisted?: boolean;
  message?: string;
};

export type DatasetSummary = {
  total_rows?: number;
  total_days?: number;
  manual_rows?: number;
  items?: string[];
  r2?: number;
};

export type DailySalesEntryInput = {
  item: string;
  sold_qty: number;
  produced_qty?: number;
  price?: number;
};

export type RecordDailySalesRequest = {
  date?: string;
  day_of_week?: DayOfWeek;
  weather?: Weather;
  discount_pct?: number;
  entries: DailySalesEntryInput[];
  retrain?: boolean;
};

export type RecordDailySalesResponse = {
  cafe_id: string;
  date: string;
  saved_count: number;
  entries: DailySalesEntryInput[];
  dataset_summary: DatasetSummary;
  message: string;
  retrain?: RetrainResult;
};

export type RetrainResult = {
  status: string;
  rows_used: number;
  r2: number;
  accuracy_pct: number;
  mae: number;
  items: string[];
  top_features?: Record<string, number>;
  cafe_id?: string;
  dataset_summary?: DatasetSummary;
  message?: string;
};

export type CafeDatasetApiResponse = {
  cafe_id: string;
  cafe_name: string;
  summary: DatasetSummary;
  recent_sales: DatasetRow[];
  items: string[];
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
  date: string;
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
  actualVsPredicted: {
    label: string;
    date: string;
    actual: number;
    predicted: number;
  }[];
  surplusTrend: SurplusPoint[];
  scatterData: ScatterPoint[];
  heatmap: HeatmapCell[];
  funnel: FunnelStage[];
  insights: string[];
};

/** Food listing categories (must match backend classifier). */
export type FoodCategory =
  | "Bakery"
  | "Pastries"
  | "Bread"
  | "Desserts"
  | "Meals"
  | "Beverages"
  | "Other";

export type ClassifyFoodResponse = {
  foodLabel: string;
  category: FoodCategory;
  confidence: number;
};
