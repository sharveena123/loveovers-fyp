// src/services/firebase/orders.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sellerId: string;
  sellerName: string;
  imageUrl?: string;
  originalPrice?: number;
  type?: "bag" | "item";
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BuyerOrder {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  discount?: number;
  shippingAddress: ShippingAddress;
  paymentIntentId: string;
  paymentStatus:
    | "pending"
    | "succeeded"
    | "failed"
    | "canceled"
    | "refund_pending"
    | "refunded";
  refundStatus?: "none" | "requested" | "processing" | "approved" | "rejected" | "refunded";
  refundReason?: string;
  refundRequestedAt?: Timestamp | Date;
  refundedAt?: Timestamp | Date;
  refundedAmount?: number;
  orderStatus:
    | "pending"
    | "ready"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// Create a new order from cart
export const createOrderFromCart = async (
  userId: string,
  items: OrderItem[],
  subtotal: number,
  total: number,
  discount: number,
  shippingAddress: ShippingAddress,
  paymentIntentId: string,
): Promise<string> => {
  try {
    const ordersCol = collection(db, "users", userId, "orders");
    const orderDocRef = doc(ordersCol);

    // Clean the order object to remove any undefined values
    const order: BuyerOrder = {
      id: orderDocRef.id,
      userId,
      items: items || [],
      subtotal: subtotal || 0,
      total: total || 0,
      discount: discount || 0,
      shippingAddress: {
        fullName: shippingAddress?.fullName || "",
        email: shippingAddress?.email || "",
        phone: shippingAddress?.phone || "",
        street: shippingAddress?.street || "",
        city: shippingAddress?.city || "",
        state: shippingAddress?.state || "",
        postalCode: shippingAddress?.postalCode || "",
      },
      paymentIntentId: paymentIntentId || "",
      paymentStatus: paymentIntentId?.startsWith("pi_test")
        ? "succeeded"
        : "pending",
      refundStatus: "none",
      orderStatus: "pending",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(orderDocRef, order);

    // Also create seller-specific order entries for each seller
    try {
      const sellerIds = [...new Set(items.map((item) => item.sellerId))];

      for (const sellerId of sellerIds) {
        try {
          const sellerItems = items.filter(
            (item) => item.sellerId === sellerId,
          );
          const sellerOrdersCol = collection(db, "sellers", sellerId, "orders");
          const sellerOrderDocRef = doc(sellerOrdersCol);

          const sellerSubtotal = sellerItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );

          const sellerOrder = {
            id: sellerOrderDocRef.id,
            orderId: orderDocRef.id,
            buyerId: userId,
            customerName: shippingAddress.fullName,
            customerPhone: shippingAddress.phone,
            customerEmail: shippingAddress.email,
            items: sellerItems,
            subtotal: sellerSubtotal,
            total: sellerSubtotal,
            discount: 0,
            shippingAddress,
            paymentIntentId: paymentIntentId || "",
            paymentStatus: "pending",
            status: "pending",
            pickupTime: shippingAddress.city,
            pickupLocation: shippingAddress.street,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          await setDoc(sellerOrderDocRef, sellerOrder);
        } catch (sellerError) {
          console.error(
            `Error creating seller order for ${sellerId}:`,
            sellerError,
          );
        }
      }
    } catch (sellerError) {
      console.error("Error creating seller orders:", sellerError);
    }

    return orderDocRef.id;
  } catch (error) {
    console.error("Error creating order from cart:", error);
    throw error;
  }
};

/** Combine multiple seller-side statuses for one buyer checkout. */
function aggregateSellerStatuses(
  statuses: string[],
): BuyerOrder["orderStatus"] | null {
  const normalized = statuses.map((s) => String(s || "pending").toLowerCase());
  if (!normalized.length) return null;
  if (normalized.every((s) => s === "cancelled")) return "cancelled";
  if (normalized.every((s) => s === "completed")) return "delivered";
  if (normalized.every((s) => s === "pending")) return "pending";
  if (normalized.some((s) => s === "ready" || s === "confirmed")) return "ready";
  return sellerStatusToBuyerOrderStatus(normalized[0]);
}

function appendSellerStatus(
  map: Map<string, string[]>,
  buyerOrderId: string,
  status: string,
) {
  if (!buyerOrderId) return;
  const existing = map.get(buyerOrderId) ?? [];
  existing.push(status);
  map.set(buyerOrderId, existing);
}

async function fetchSellerStatusesByBuyerOrderId(
  buyerId: string,
  sellerIds: string[],
  buyerOrderIds: string[],
): Promise<Map<string, string[]>> {
  const byBuyerOrderId = new Map<string, string[]>();

  for (const sellerId of sellerIds) {
    const col = collection(db, "sellers", sellerId, "orders");
    const [byBuyerIdSnap, byCustomerIdSnap] = await Promise.all([
      getDocs(query(col, where("buyerId", "==", buyerId))),
      getDocs(query(col, where("customerId", "==", buyerId))),
    ]);

    const seenDocIds = new Set<string>();
    for (const snap of [byBuyerIdSnap, byCustomerIdSnap]) {
      for (const orderDoc of snap.docs) {
        if (seenDocIds.has(orderDoc.id)) continue;
        seenDocIds.add(orderDoc.id);

        const data = orderDoc.data();
        appendSellerStatus(
          byBuyerOrderId,
          String(data.orderId || ""),
          String(data.status || "pending"),
        );
      }
    }

    // Fallback: match seller docs by buyer order id (legacy / mock data)
    for (const buyerOrderId of buyerOrderIds) {
      const byOrderIdSnap = await getDocs(
        query(col, where("orderId", "==", buyerOrderId)),
      );
      for (const orderDoc of byOrderIdSnap.docs) {
        appendSellerStatus(
          byBuyerOrderId,
          buyerOrderId,
          String(orderDoc.data().status || "pending"),
        );
      }
    }
  }

  return byBuyerOrderId;
}

/** Mirror seller order status onto buyer orders (read + optional self-heal write). */
async function enrichBuyerOrdersFromSellerStatus(
  buyerId: string,
  orders: BuyerOrder[],
): Promise<BuyerOrder[]> {
  const sellerIds = [
    ...new Set(
      orders.flatMap((o) =>
        (o.items ?? []).map((i) => i.sellerId).filter(Boolean),
      ),
    ),
  ];
  if (!sellerIds.length) return orders;

  const statusMap = await fetchSellerStatusesByBuyerOrderId(
    buyerId,
    sellerIds,
    orders.map((o) => o.id),
  );

  return Promise.all(
    orders.map(async (order) => {
      const sellerStatuses = statusMap.get(order.id);
      if (!sellerStatuses?.length) return order;

      const aggregated = aggregateSellerStatuses(sellerStatuses);
      if (!aggregated || aggregated === order.orderStatus) return order;

      updateBuyerOrderStatus(buyerId, order.id, { orderStatus: aggregated }).catch(
        (err) => console.warn("Could not persist buyer order status:", err),
      );

      return { ...order, orderStatus: aggregated };
    }),
  );
}

// Get buyer orders (status synced from sellers/{sellerId}/orders)
export const getBuyerOrders = async (userId: string): Promise<BuyerOrder[]> => {
  try {
    const ordersCol = collection(db, "users", userId, "orders");
    const snapshot = await getDocs(ordersCol);
    const orders = snapshot.docs.map(
      (orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }) as BuyerOrder,
    );
    return enrichBuyerOrdersFromSellerStatus(userId, orders);
  } catch (error) {
    console.error("Error getting buyer orders:", error);
    throw error;
  }
};

// Get single order
export const getOrder = async (
  userId: string,
  orderId: string,
): Promise<BuyerOrder | null> => {
  try {
    const docRef = doc(db, "users", userId, "orders", orderId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as BuyerOrder;
    }
    return null;
  } catch (error) {
    console.error("Error getting order:", error);
    throw error;
  }
};

// Update buyer order status
export const updateBuyerOrderStatus = async (
  userId: string,
  orderId: string,
  updates: Partial<BuyerOrder>,
) => {
  try {
    const docRef = doc(db, "users", userId, "orders", orderId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};

// Get seller orders (from their customers)
export const getSellerOrders = async (sellerId: string) => {
  try {
    const ordersCol = collection(db, "sellers", sellerId, "orders");
    const snapshot = await getDocs(ordersCol);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting seller orders:", error);
    throw error;
  }
};

/** Maps seller `status` field → buyer `orderStatus` on users/{uid}/orders */
export function sellerStatusToBuyerOrderStatus(
  sellerStatus: string,
): BuyerOrder["orderStatus"] | null {
  const map: Record<string, BuyerOrder["orderStatus"]> = {
    pending: "pending",
    ready: "ready",
    confirmed: "confirmed",
    completed: "delivered",
    cancelled: "cancelled",
  };
  return map[sellerStatus] ?? null;
}

// Update seller order status and mirror to the buyer's order document
export const updateOrderStatus = async (
  sellerId: string,
  sellerOrderDocId: string,
  status: string,
) => {
  try {
    const sellerRef = doc(db, "sellers", sellerId, "orders", sellerOrderDocId);
    const snap = await getDoc(sellerRef);
    if (!snap.exists()) {
      throw new Error("Seller order not found");
    }

    const data = snap.data();
    await updateDoc(sellerRef, {
      status,
      updatedAt: Timestamp.now(),
    });

    const buyerId = (data.buyerId ?? data.customerId) as string | undefined;
    const buyerOrderId = data.orderId as string | undefined;
    const buyerStatus = sellerStatusToBuyerOrderStatus(status);

    if (buyerId && buyerOrderId && buyerStatus) {
      try {
        await updateBuyerOrderStatus(buyerId, buyerOrderId, {
          orderStatus: buyerStatus,
        });
      } catch (buyerSyncError) {
        // Seller clients often cannot write users/{buyerId}/orders — buyer syncs on load.
        console.warn(
          "Buyer order status not updated from seller (will sync when buyer opens orders):",
          buyerSyncError,
        );
      }
    } else {
      console.warn(
        "Seller order missing buyerId/orderId — buyer status cannot sync:",
        { buyerId, buyerOrderId, sellerOrderDocId },
      );
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};
