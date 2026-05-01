import {
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "./config";

export interface CartItem {
  id: string;
  name: string;
  sellerName: string;
  sellerId: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  imageUrl?: string;
  type: "bag" | "item";
  addedAt: Timestamp | Date;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: Timestamp | Date;
}

// Get user's cart
export async function getUserCart(userId: string): Promise<CartItem[]> {
  try {
    const cartRef = doc(db, "carts", userId);
    const cartSnap = await getDoc(cartRef);

    if (cartSnap.exists()) {
      return cartSnap.data().items || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting cart:", error);
    throw error;
  }
}

// Add item to cart
export async function addToCart(
  userId: string,
  item: Omit<CartItem, "addedAt">,
): Promise<void> {
  try {
    const cartRef = doc(db, "carts", userId);
    const cartSnap = await getDoc(cartRef);

    // Sanitize item to remove undefined fields
    const cleanItem = Object.fromEntries(
      Object.entries(item).filter(([, value]) => value !== undefined),
    ) as Omit<CartItem, "addedAt">;

    const itemWithTimestamp = {
      ...cleanItem,
      addedAt: new Date(),
    };

    if (cartSnap.exists()) {
      const existingCart = cartSnap.data();
      const items = existingCart.items || [];

      // Check if item already exists in cart
      const existingItemIndex = items.findIndex(
        (i: CartItem) => i.id === item.id,
      );

      if (existingItemIndex > -1) {
        // Item exists, update quantity
        items[existingItemIndex].quantity += item.quantity;
      } else {
        // New item, add to cart
        items.push(itemWithTimestamp);
      }

      await updateDoc(cartRef, {
        items,
        updatedAt: new Date(),
      });
    } else {
      // Create new cart
      await setDoc(cartRef, {
        userId,
        items: [itemWithTimestamp],
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
}

// Remove item from cart
export async function removeFromCart(
  userId: string,
  itemId: string,
): Promise<void> {
  try {
    const cartRef = doc(db, "carts", userId);
    const cartSnap = await getDoc(cartRef);

    if (cartSnap.exists()) {
      const items = cartSnap.data().items || [];
      const updatedItems = items.filter((item: CartItem) => item.id !== itemId);

      if (updatedItems.length === 0) {
        // Delete cart if empty
        await deleteDoc(cartRef);
      } else {
        await updateDoc(cartRef, {
          items: updatedItems,
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error removing from cart:", error);
    throw error;
  }
}

// Update item quantity in cart
export async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  try {
    const cartRef = doc(db, "carts", userId);
    const cartSnap = await getDoc(cartRef);

    if (cartSnap.exists()) {
      const items = cartSnap.data().items || [];

      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        await removeFromCart(userId, itemId);
      } else {
        const updatedItems = items.map((item: CartItem) =>
          item.id === itemId ? { ...item, quantity } : item,
        );

        await updateDoc(cartRef, {
          items: updatedItems,
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    throw error;
  }
}

// Clear entire cart
export async function clearCart(userId: string): Promise<void> {
  try {
    const cartRef = doc(db, "carts", userId);
    await deleteDoc(cartRef);
  } catch (error) {
    console.error("Error clearing cart:", error);
    throw error;
  }
}
