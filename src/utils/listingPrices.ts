import type { AvailableBag } from "@/src/services/firebase/buyerInventory";
import type { InventoryItem } from "@/src/services/firebase/inventoryServices";

/** Seller-published sale floor before extra smart-pricing markdown. */
export function getListingFloor(
  item: Pick<InventoryItem, "price" | "discountedPrice">,
): number {
  return item.discountedPrice ?? item.price ?? 0;
}

export type BuyerPriceDisplay = {
  /** Live amount the buyer pays (matches seller dashboard live price). */
  salePrice: number;
  /** Opening sale / list floor stored by the seller. */
  listFloor: number;
  /** Original retail value. */
  retail: number;
  /** Rounded % off retail. */
  discountPct: number;
  /** Strikethrough price shown next to sale (seller-style). */
  compareAtPrice: number | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolves buyer-facing prices: sale = live price; compare-at = retail.
 *
 * The strikethrough (compare-at) and the discount % must share the same base,
 * otherwise the badge contradicts the prices on screen. Both are anchored to
 * retail — the same base checkout uses for "Saving RM X" — so the rate shown
 * always equals (compareAt - sale) / compareAt.
 */
export function resolveBuyerPriceDisplay(
  bag: Pick<
    AvailableBag,
    "price" | "discountedPrice" | "originalPrice" | "listFloorPrice"
  >,
): BuyerPriceDisplay {
  const listFloor = roundMoney(
    bag.listFloorPrice ?? getListingFloor(bag),
  );
  const salePrice = roundMoney(bag.price ?? bag.discountedPrice ?? listFloor);
  const retail = roundMoney(
    Math.max(bag.originalPrice ?? salePrice, salePrice, listFloor),
  );

  const compareAtPrice = retail > salePrice + 0.004 ? retail : null;

  const discountPct =
    compareAtPrice != null && salePrice > 0
      ? Math.max(
          0,
          Math.round(((compareAtPrice - salePrice) / compareAtPrice) * 100),
        )
      : 0;

  return { salePrice, listFloor, retail, discountPct, compareAtPrice };
}
