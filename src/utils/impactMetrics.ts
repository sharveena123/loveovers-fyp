/**
 * Environmental impact estimates for surplus-food rescue.
 * References: ~0.4 kg food per meal; ~2.5 kg CO₂e per kg food waste avoided
 * → ~1.0 kg CO₂e per meal rescued (conservative round number for UX).
 */

export const IMPACT_CONSTANTS = {
  MEALS_PER_ITEM: 1,
  MEALS_PER_MYSTERY_BAG: 2.5,
  CO2_KG_PER_MEAL: 1.0,
  FOOD_KG_PER_MEAL: 0.4,
  /** Used when original retail price was not stored on the order line. */
  DEFAULT_RETAIL_MARKUP: 1.35,
} as const;

export interface ImpactLineItem {
  quantity: number;
  price: number;
  originalPrice?: number;
  type?: "bag" | "item" | string;
  name?: string;
}

export function inferItemType(
  type?: string,
  name?: string,
): "bag" | "item" {
  if (type === "bag") return "bag";
  if (type === "item") return "item";
  const lower = (name || "").toLowerCase();
  if (lower.includes("mystery") || lower.includes("surprise bag")) {
    return "bag";
  }
  return "item";
}

export function mealsFromLineItem(item: ImpactLineItem): number {
  const qty = Math.max(0, item.quantity || 0);
  const kind = inferItemType(item.type, item.name);
  const perUnit =
    kind === "bag"
      ? IMPACT_CONSTANTS.MEALS_PER_MYSTERY_BAG
      : IMPACT_CONSTANTS.MEALS_PER_ITEM;
  return qty * perUnit;
}

export function retailPricePerUnit(item: ImpactLineItem): number {
  if (item.originalPrice && item.originalPrice > item.price) {
    return item.originalPrice;
  }
  return item.price * IMPACT_CONSTANTS.DEFAULT_RETAIL_MARKUP;
}

export function moneySavedFromLineItem(item: ImpactLineItem): number {
  const retail = retailPricePerUnit(item);
  return Math.max(0, retail - item.price) * Math.max(0, item.quantity || 0);
}

export function co2KgFromMeals(meals: number): number {
  return (
    Math.round(
      Math.max(0, meals) * IMPACT_CONSTANTS.CO2_KG_PER_MEAL * 10,
    ) / 10
  );
}

export function foodKgFromMeals(meals: number): number {
  return (
    Math.round(
      Math.max(0, meals) * IMPACT_CONSTANTS.FOOD_KG_PER_MEAL * 10,
    ) / 10
  );
}

export function formatCo2(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}t`;
  }
  if (kg === 0) return "0kg";
  return Number.isInteger(kg) ? `${kg}kg` : `${kg.toFixed(1)}kg`;
}

export function formatMeals(meals: number): string {
  const rounded = Math.round(meals * 10) / 10;
  return Number.isInteger(rounded)
    ? String(Math.round(rounded))
    : rounded.toFixed(1);
}

export function formatCurrency(rm: number): string {
  if (rm >= 1000) {
    return `RM ${(rm / 1000).toFixed(1)}k`;
  }
  return `RM ${Math.round(rm)}`;
}

export function aggregateLineItems(items: ImpactLineItem[]) {
  let mealsRescued = 0;
  let moneySaved = 0;

  for (const item of items) {
    mealsRescued += mealsFromLineItem(item);
    moneySaved += moneySavedFromLineItem(item);
  }

  return {
    mealsRescued: Math.round(mealsRescued * 10) / 10,
    moneySaved: Math.round(moneySaved * 100) / 100,
    co2SavedKg: co2KgFromMeals(mealsRescued),
    foodSavedKg: foodKgFromMeals(mealsRescued),
  };
}
