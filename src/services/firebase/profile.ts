import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  aggregateLineItems,
  co2KgFromMeals,
  ImpactLineItem,
} from "@/src/utils/impactMetrics";
import { db } from "./config";

export interface ProfileStats {
  totalSales: number;
  /** Average store rating from `sellers/{id}.rating`; 0 when not yet rated. */
  rating: number;
  /** % of listed inventory units that were sold (rescue rate). */
  savedPercentage: number;
  mealsSaved: number;
  /** kg CO₂ equivalent avoided. */
  co2SavedKg: number;
  /** Total RM earned from rescue orders the seller accepted. */
  revenueSaved: number;
  foodSavedKg: number;
  itemsSold: number;
}

const EMPTY_PROFILE_STATS: ProfileStats = {
  totalSales: 0,
  rating: 0,
  savedPercentage: 0,
  mealsSaved: 0,
  co2SavedKg: 0,
  revenueSaved: 0,
  foodSavedKg: 0,
  itemsSold: 0,
};

/**
 * Only orders the seller has accepted count toward sales/impact.
 * Pending checkouts may still be cancelled, so they are excluded.
 */
const COUNTED_ORDER_STATUSES = new Set(["completed", "ready", "confirmed"]);

export const getProfileStats = async (
  sellerId: string,
): Promise<ProfileStats> => {
  try {
    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const ordersSnapshot = await getDocs(ordersRef);

    let totalSales = 0;
    let revenueSaved = 0;
    const lineItems: ImpactLineItem[] = [];
    /** Inventory listing id -> units sold across counted orders. */
    const soldByListingId = new Map<string, number>();

    ordersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const status = String(data.status || "pending");

      if (!COUNTED_ORDER_STATUSES.has(status)) return;

      totalSales += 1;
      revenueSaved += data.total || data.subtotal || 0;

      const items = (data.items || []) as Array<{
        id?: string;
        quantity?: number;
        price?: number;
        originalPrice?: number;
        type?: string;
        name?: string;
      }>;

      for (const item of items) {
        lineItems.push({
          quantity: item.quantity || 1,
          price: item.price || 0,
          originalPrice: item.originalPrice,
          type: item.type,
          name: item.name,
        });

        if (item.id) {
          soldByListingId.set(
            item.id,
            (soldByListingId.get(item.id) || 0) + (item.quantity || 1),
          );
        }
      }
    });

    const aggregated = aggregateLineItems(lineItems);
    const mealsSaved = aggregated.mealsRescued;

    const inventoryRef = collection(db, "sellers", sellerId, "inventory");
    const inventorySnapshot = await getDocs(inventoryRef);

    let totalListed = 0;
    let totalSold = 0;

    inventorySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const listed = data.quantity || 0;
      const soldFromOrders = soldByListingId.get(docSnap.id) || 0;
      const sold = Math.min(listed, soldFromOrders);
      totalListed += listed;
      totalSold += sold;
    });

    const rescueRate =
      totalListed > 0 ? Math.min(100, (totalSold / totalListed) * 100) : 0;
    const savedPercentage = Math.round(rescueRate);

    const itemsSold = lineItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    // Store rating lives on the public seller doc (0 until buyers rate the store).
    let rating = 0;
    const sellerSnap = await getDoc(doc(db, "sellers", sellerId));
    if (sellerSnap.exists()) {
      const sellerRating = sellerSnap.data()?.rating;
      if (typeof sellerRating === "number" && sellerRating > 0) {
        rating = Math.min(5, sellerRating);
      }
    }

    return {
      totalSales,
      rating,
      savedPercentage,
      mealsSaved: Math.round(mealsSaved),
      co2SavedKg: co2KgFromMeals(mealsSaved),
      revenueSaved: Math.round(revenueSaved * 100) / 100,
      foodSavedKg: aggregated.foodSavedKg,
      itemsSold,
    };
  } catch (error) {
    console.error("Error fetching profile stats:", error);
    return EMPTY_PROFILE_STATS;
  }
};
