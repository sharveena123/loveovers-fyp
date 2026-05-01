import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface Order {
  id: string;
  userId: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    sellerId: string;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  shippingAddress: {
    fullName: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
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

// Create a payment intent by calling backend API
export async function createPaymentIntent(
  userId: string,
  amount: number,
  cartItems: any[] = [],
): Promise<PaymentIntent> {
  try {
    // Call your backend API to create payment intent
    // This should be a Cloud Function or your own API endpoint
    const response = await fetch("YOUR_BACKEND_URL/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        amount: Math.round(amount * 100), // Convert to cents
        cartItems,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create payment intent");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw error;
  }
}

// Save order to Firebase
export async function saveOrder(order: Omit<Order, "id">): Promise<string> {
  try {
    const orderRef = doc(db, "users", order.userId, "orders");
    const newOrder: Order = {
      ...order,
      id: orderRef.id,
    };

    await setDoc(
      doc(db, "users", order.userId, "orders", orderRef.id),
      newOrder,
    );
    return orderRef.id;
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

// Update order status
export async function updateOrderStatus(
  userId: string,
  orderId: string,
  updates: Partial<Order>,
): Promise<void> {
  try {
    const orderRef = doc(db, "users", userId, "orders", orderId);
    await setDoc(
      orderRef,
      {
        ...updates,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
}

// Get user orders
export async function getUserOrders(userId: string): Promise<Order[]> {
  try {
    const response = await fetch(
      `YOUR_BACKEND_URL/user-orders?userId=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
}
