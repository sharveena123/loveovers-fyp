import { FoodCategory } from "@/src/ai/types";
import { ItemCategory } from "@/src/services/firebase/inventoryServices";

const LISTING_CATEGORIES: ItemCategory[] = [
  "Bakery",
  "Pastries",
  "Bread",
  "Desserts",
  "Meals",
  "Beverages",
  "Other",
];

/** ImageNet / scene labels that are not useful product names. */
const GENERIC_FOOD_LABELS = new Set([
  "bakery",
  "bakehouse",
  "bakershop",
  "shop",
  "store",
  "restaurant",
  "food",
  "meal",
  "grocery",
  "market",
  "cafe",
  "coffee",
  "kitchen",
  "dining",
  "room",
  "indoor",
  "outdoor",
  "tray",
  "plate",
  "counter",
  "display",
  "shelf",
]);

export const formatFoodLabel = (label: string): string =>
  label
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/**
 * Returns a display name only when the AI label is a real food name,
 * not a category name ("Bakery") or generic scene label.
 */
export function foodLabelToItemName(
  foodLabel: string,
  category: ItemCategory,
  businessName?: string,
): string | null {
  const trimmed = foodLabel.trim();
  if (!trimmed) return null;

  const formatted = formatFoodLabel(trimmed);
  const lower = formatted.toLowerCase();

  if (GENERIC_FOOD_LABELS.has(lower)) return null;
  if (LISTING_CATEGORIES.some((c) => c.toLowerCase() === lower)) return null;
  if (lower === category.toLowerCase()) return null;

  const business = businessName?.trim().toLowerCase();
  if (business && (lower === business || business.includes(lower))) {
    return null;
  }

  return formatted;
}

export function parseClassifyFoodResponse(
  raw: Record<string, unknown>,
): {
  foodLabel: string;
  category: FoodCategory;
  confidence: number;
} {
  let foodLabel = String(
    raw.foodLabel ?? raw.food_label ?? raw.item_name ?? "",
  ).trim();

  const category = (raw.category ??
    raw.predictedCategory ??
    "Other") as FoodCategory;

  const confidence = Number(raw.confidence ?? 0);

  // Backend must not use category / café name as foodLabel.
  if (foodLabel.toLowerCase() === String(category).toLowerCase()) {
    foodLabel = "";
  }

  const cafeName = String(raw.cafe_name ?? raw.cafeName ?? "").trim();
  if (cafeName && foodLabel.toLowerCase() === cafeName.toLowerCase()) {
    foodLabel = "";
  }

  return { foodLabel, category, confidence };
}
