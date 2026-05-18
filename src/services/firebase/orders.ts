// src/services/firebase/orders.ts
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    Timestamp,
    updateDoc,
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
  paymentStatus: "pending" | "succeeded" | "failed" | "canceled";
  orderStatus:
    | "pending"
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
      paymentStatus: "pending",
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

// Get buyer orders
export const getBuyerOrders = async (userId: string): Promise<BuyerOrder[]> => {
  try {
    const ordersCol = collection(db, "users", userId, "orders");
    const snapshot = await getDocs(ordersCol);
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as BuyerOrder,
    );
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

// Update seller order status
export const updateOrderStatus = async (
  sellerId: string,
  orderId: string,
  status: string,
) => {
  try {
    const docRef = doc(db, "sellers", sellerId, "orders", orderId);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};
