import type { AvailableBag } from "@/src/services/firebase/buyerInventory";
import type { InventoryItem } from "@/src/services/firebase/inventoryServices";
import type { BuyerOrder } from "@/src/services/firebase/orders";
import {
  isListingExpired,
  resolveExpiryDate,
} from "@/src/services/pricing/dynamicPricing";
import { resolveBuyerPriceDisplay } from "@/src/utils/listingPrices";
import type { SmartReminder } from "@/src/types/smartReminders";

const MAX_REMINDERS = 4;

function hoursUntilExpiry(item: InventoryItem | AvailableBag): number | null {
  const expiry = resolveExpiryDate(item);
  if (!expiry || isListingExpired(item)) return null;
  return (expiry.getTime() - Date.now()) / (1000 * 60 * 60);
}

function sortByPriority(reminders: SmartReminder[]): SmartReminder[] {
  const weight = { urgent: 0, high: 1, normal: 2 };
  return [...reminders].sort(
    (a, b) => weight[a.priority] - weight[b.priority],
  );
}

export function buildBuyerReminders(params: {
  orders: BuyerOrder[];
  cartItemCount: number;
  bags: AvailableBag[];
  unreadMessages?: number;
}): SmartReminder[] {
  const { orders, cartItemCount, bags, unreadMessages = 0 } = params;
  const reminders: SmartReminder[] = [];

  const readyOrders = orders.filter((o) => o.orderStatus === "ready");
  if (readyOrders.length > 0) {
    const order = readyOrders[0];
    reminders.push({
      id: `buyer-order-ready-${order.id}`,
      title: "Order ready for pickup",
      message:
        readyOrders.length === 1
          ? `Order #${order.id.slice(0, 8).toUpperCase()} is waiting at the bakery.`
          : `${readyOrders.length} orders are ready — head over before they close.`,
      icon: "package",
      priority: "urgent",
      actionUrl: "/(buyer)/buyerorders",
      actionLabel: "View orders",
    });
  }

  const pendingPickup = orders.filter(
    (o) => o.orderStatus === "pending" || o.orderStatus === "confirmed",
  );
  if (pendingPickup.length > 0 && readyOrders.length === 0) {
    reminders.push({
      id: "buyer-pending-pickup",
      title: "Pickup coming up",
      message: `You have ${pendingPickup.length} active order${pendingPickup.length > 1 ? "s" : ""} — check pickup details.`,
      icon: "clock",
      priority: "high",
      actionUrl: "/(buyer)/buyerorders",
      actionLabel: "Track order",
    });
  }

  if (cartItemCount > 0) {
    reminders.push({
      id: "buyer-cart-items",
      title: "Items in your cart",
      message: `${cartItemCount} item${cartItemCount > 1 ? "s" : ""} reserved — checkout before they sell out.`,
      icon: "cart",
      priority: "high",
      actionUrl: "/(buyer)/buyercart",
      actionLabel: "Go to cart",
    });
  }

  const expiringSoon = bags.filter((bag) => {
    const hours = hoursUntilExpiry(bag);
    return hours != null && hours > 0 && hours <= 3;
  });
  if (expiringSoon.length > 0) {
    const nearest = expiringSoon.sort(
      (a, b) => (hoursUntilExpiry(a) ?? 99) - (hoursUntilExpiry(b) ?? 99),
    )[0];
    const hours = Math.max(1, Math.ceil(hoursUntilExpiry(nearest) ?? 1));
    reminders.push({
      id: `buyer-expiring-${nearest.id}`,
      title: "Ending soon near you",
      message: `${expiringSoon.length} deal${expiringSoon.length > 1 ? "s" : ""} expire within ${hours}h — ${nearest.sellerName} has fresh surplus.`,
      icon: "flame",
      priority: "urgent",
      actionUrl: "/(buyer)/buyermap",
      actionLabel: "See on map",
    });
  }

  const topDeal = [...bags]
    .map((bag) => ({
      bag,
      discount: resolveBuyerPriceDisplay(bag).discountPct,
    }))
    .filter((x) => x.discount >= 25)
    .sort((a, b) => b.discount - a.discount)[0];

  if (topDeal && !reminders.some((r) => r.id.startsWith("buyer-expiring"))) {
    reminders.push({
      id: `buyer-deal-${topDeal.bag.id}`,
      title: "Top deal nearby",
      message: `${topDeal.discount}% off at ${topDeal.bag.sellerName} — prices drop as closing time nears.`,
      icon: "trending",
      priority: "normal",
      actionUrl:
        topDeal.bag.type === "bag"
          ? `/(buyer)/mysterydetail/${topDeal.bag.id}`
          : `/(buyer)/itemdetail/${topDeal.bag.id}`,
      actionLabel: "View deal",
    });
  }

  const day = new Date().getDay();
  if ((day === 0 || day === 6) && bags.length > 0) {
    reminders.push({
      id: "buyer-weekend",
      title: "Weekend rescue tip",
      message:
        "Bakeries often list extra surplus on weekends — check the map for fresh drops.",
      icon: "sparkles",
      priority: "normal",
      actionUrl: "/(buyer)/buyermap",
      actionLabel: "Browse map",
    });
  }

  if (unreadMessages > 0) {
    reminders.push({
      id: "buyer-unread-chat",
      title: "New messages",
      message: `${unreadMessages} unread message${unreadMessages > 1 ? "s" : ""} from sellers.`,
      icon: "message",
      priority: "high",
      actionUrl: "/(buyer)/buychat",
      actionLabel: "Open chat",
    });
  }

  return sortByPriority(reminders).slice(0, MAX_REMINDERS);
}

export function buildSellerReminders(params: {
  inventory: InventoryItem[];
  pendingOrderCount: number;
  itemsExpiring: number;
  unreadMessages?: number;
}): SmartReminder[] {
  const {
    inventory,
    pendingOrderCount,
    itemsExpiring,
    unreadMessages = 0,
  } = params;
  const reminders: SmartReminder[] = [];

  const urgentItems = inventory
    .filter((item) => {
      const hours = hoursUntilExpiry(item);
      return hours != null && hours > 0 && hours <= 2;
    })
    .sort(
      (a, b) =>
        (hoursUntilExpiry(a) ?? 99) - (hoursUntilExpiry(b) ?? 99),
    );

  if (urgentItems.length > 0) {
    const first = urgentItems[0];
    const hours = Math.max(1, Math.ceil(hoursUntilExpiry(first) ?? 1));
    reminders.push({
      id: `seller-expiry-${first.id}`,
      title: "Expiring very soon",
      message:
        urgentItems.length === 1
          ? `${first.name} expires in ~${hours}h — add to a mystery bag or adjust price.`
          : `${urgentItems.length} listings expire within 2h. Move them to a mystery bag.`,
      icon: "alert",
      priority: "urgent",
      actionUrl: "/(seller)/(tabs)/dashboard",
      actionLabel: "Review listings",
    });
  } else if (itemsExpiring > 0) {
    reminders.push({
      id: "seller-expiring-count",
      title: "Items expiring today",
      message: `${itemsExpiring} listing${itemsExpiring > 1 ? "s" : ""} need attention before closing.`,
      icon: "clock",
      priority: "high",
      actionUrl: "/(seller)/(tabs)/dashboard",
      actionLabel: "View inventory",
    });
  }

  if (pendingOrderCount > 0) {
    reminders.push({
      id: "seller-pending-orders",
      title: "Orders awaiting pickup",
      message: `${pendingOrderCount} customer${pendingOrderCount > 1 ? "s" : ""} waiting — mark ready when packed.`,
      icon: "package",
      priority: "urgent",
      actionUrl: "/(seller)/(tabs)/orders",
      actionLabel: "Manage orders",
    });
  }

  const lowStock = inventory.filter(
    (item) => item.quantity > 0 && item.quantity <= 2,
  );
  if (lowStock.length > 0) {
    const names = lowStock
      .slice(0, 2)
      .map((i) => i.name)
      .join(", ");
    reminders.push({
      id: "seller-low-stock",
      title: "Low stock",
      message: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} running low (${names}${lowStock.length > 2 ? "…" : ""}).`,
      icon: "alert",
      priority: "high",
      actionUrl: "/(seller)/(tabs)/dashboard",
      actionLabel: "Restock",
    });
  }

  const hasMysteryBag = inventory.some((item) => item.type === "bag");
  if (!hasMysteryBag && inventory.length > 0) {
    reminders.push({
      id: "seller-no-mystery-bag",
      title: "Create a mystery bag",
      message:
        "Bundle expiring items into a mystery bag to cut waste and reach more buyers.",
      icon: "sparkles",
      priority: "normal",
      actionUrl: "/(seller)/(tabs)/dashboard",
      actionLabel: "Add bag",
    });
  }

  if (unreadMessages > 0) {
    reminders.push({
      id: "seller-unread-chat",
      title: "Customer messages",
      message: `${unreadMessages} unread message${unreadMessages > 1 ? "s" : ""} from buyers.`,
      icon: "message",
      priority: "high",
      actionUrl: "/(seller)/(tabs)/sellerchat",
      actionLabel: "Reply",
    });
  }

  return sortByPriority(reminders).slice(0, MAX_REMINDERS);
}
