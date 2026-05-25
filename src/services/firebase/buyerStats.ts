import { getBuyerOrders } from "@/src/services/firebase/orders";
import {
  aggregateLineItems,
  ImpactLineItem,
} from "@/src/utils/impactMetrics";

export interface BuyerStats {
  /** Total meal equivalents rescued (items + mystery bags weighted). */
  mealsRescued: number;
  /** Number of non-cancelled orders. */
  ordersCount: number;
  /** Estimated RM saved vs estimated retail prices. */
  moneySaved: number;
  /** kg CO₂ equivalent avoided. */
  co2Saved: number;
  /** kg of food diverted from waste. */
  foodSavedKg: number;
  /** @deprecated Use mealsRescued — kept for older UI references */
  bagsSaved: number;
}

const EMPTY_STATS: BuyerStats = {
  mealsRescued: 0,
  ordersCount: 0,
  moneySaved: 0,
  co2Saved: 0,
  foodSavedKg: 0,
  bagsSaved: 0,
};

export const getBuyerStats = async (buyerId: string): Promise<BuyerStats> => {
  try {
    const orders = await getBuyerOrders(buyerId);

    const lineItems: ImpactLineItem[] = [];
    let ordersCount = 0;
    let orderLevelDiscount = 0;

    for (const order of orders) {
      if (order.orderStatus === "cancelled") continue;

      ordersCount += 1;

      if (order.discount && order.discount > 0) {
        orderLevelDiscount += order.discount;
      }

      for (const item of order.items || []) {
        lineItems.push({
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice,
          type: item.type,
          name: item.name,
        });
      }
    }

    const aggregated = aggregateLineItems(lineItems);

    const moneySaved =
      orderLevelDiscount > 0
        ? Math.round(orderLevelDiscount * 100) / 100
        : aggregated.moneySaved;

    const mealsRescued = aggregated.mealsRescued;

    return {
      mealsRescued,
      ordersCount,
      moneySaved,
      co2Saved: aggregated.co2SavedKg,
      foodSavedKg: aggregated.foodSavedKg,
      bagsSaved: mealsRescued,
    };
  } catch (error) {
    console.error("Error fetching buyer stats:", error);
    return EMPTY_STATS;
  }
};
