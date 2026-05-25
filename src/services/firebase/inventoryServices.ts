import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { updateOrderStatus as syncSellerAndBuyerOrderStatus } from "./orders";
import {
  isListingExpired,
  resolveExpiryDate,
} from "@/src/services/pricing/dynamicPricing";
import { db } from "./config";

export type ItemType = "bag" | "item";
export type ItemStatus =
  | "active"
  | "expired"
  | "sold_out"
  | "fresh"
  | "expiring";
export type ItemCategory =
  | "Bakery"
  | "Pastries"
  | "Bread"
  | "Desserts"
  | "Meals"
  | "Beverages"
  | "Other";

export interface InventoryItem {
  id?: string;
  sellerId: string;
  name: string;
  type: ItemType;
  category: ItemCategory;
  description?: string;
  quantity: number;
  sold?: number;
  price: number;
  originalPrice?: number;
  discountedPrice?: number;
  /** When true (default for bags), live price uses expiry / demand / closing-time engine. */
  smartPricingEnabled?: boolean;
  /** A/B curve: stable vs slightly more aggressive markdown (assigned from listing id). */
  smartPricingStrategy?: "stable" | "aggressive";
  expiryDate: string;
  expiryTime?: Timestamp;
  status: ItemStatus;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Order {
  id?: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  mysteryBag?: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: "pending" | "ready" | "confirmed" | "completed" | "cancelled";
  pickupTime?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

class InventoryService {
  // Add bag (mystery bag)
  async addBag(
    sellerId: string,
    data: {
      name: string;
      category: ItemCategory;
      quantity: number;
      originalPrice: number;
      discountedPrice: number;
      expiryDate: string;
      expiryTime: string;
      imageUrl?: string;
    }
  ): Promise<void> {
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");

    const expiryDateTime = new Date(`${data.expiryDate}T${data.expiryTime}`);

    const bagData: any = {
      sellerId,
      name: data.name,
      type: "bag" as ItemType,
      category: data.category,
      quantity: data.quantity,
      sold: 0,
      price: data.discountedPrice,
      originalPrice: data.originalPrice,
      discountedPrice: data.discountedPrice,
      smartPricingEnabled: true,
      expiryDate: data.expiryDate,
      expiryTime: Timestamp.fromDate(expiryDateTime),
      status: "fresh" as ItemStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Only add imageUrl if it exists
    if (data.imageUrl) {
      bagData.imageUrl = data.imageUrl;
    }

    await addDoc(inventoryRef, bagData);
  }

  // Add individual item
  async addItem(
    sellerId: string,
    data: {
      name: string;
      category: ItemCategory;
      quantity: number;
      price: number;
      originalPrice?: number;
      discountedPrice?: number;
      smartPricingEnabled?: boolean;
      expiryDate: string;
      expiryAt: Date;
      imageUrl?: string;
    }
  ): Promise<void> {
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");

    const listFloor = data.discountedPrice ?? data.price;
    const retail = data.originalPrice ?? data.price;

    const itemData: any = {
      sellerId,
      name: data.name,
      type: "item" as ItemType,
      category: data.category,
      quantity: data.quantity,
      sold: 0,
      price: listFloor,
      originalPrice: retail,
      discountedPrice: listFloor,
      smartPricingEnabled: data.smartPricingEnabled === true,
      expiryDate: data.expiryDate,
      expiryTime: Timestamp.fromDate(data.expiryAt),
      status: "fresh" as ItemStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Only add imageUrl if it exists
    if (data.imageUrl) {
      itemData.imageUrl = data.imageUrl;
    }

    await addDoc(inventoryRef, itemData);
  }

  // Add inventory item (generic method used by AddBagModal)
  async addInventoryItem(
    sellerId: string,
    data: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">
  ): Promise<void> {
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");

    const itemData: any = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Remove undefined fields
    Object.keys(itemData).forEach((key) => {
      if (itemData[key] === undefined) {
        delete itemData[key];
      }
    });

    await addDoc(inventoryRef, itemData);
  }

  // Get inventory
  async getInventory(sellerId: string): Promise<InventoryItem[]> {
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");
    const snapshot = await getDocs(inventoryRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InventoryItem[];
  }

  // Update item
  async updateItem(
    sellerId: string,
    itemId: string,
    updates: Partial<InventoryItem>
  ): Promise<void> {
    const itemRef = doc(db, "sellers", sellerId, "inventory", itemId);

    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(itemRef, updateData);
  }

  // Delete item
  async deleteItem(sellerId: string, itemId: string): Promise<void> {
    const itemRef = doc(db, "sellers", sellerId, "inventory", itemId);
    await deleteDoc(itemRef);
  }

  /**
   * Removes expired listings and refreshes status for the rest.
   * Runs on seller dashboard load and when buyers fetch nearby stock.
   */
  async updateItemStatuses(sellerId: string): Promise<number> {
    const items = await this.getInventory(sellerId);
    const now = new Date();
    let deletedCount = 0;

    for (const item of items) {
      if (!item.id) continue;

      if (item.status === "expired" || isListingExpired(item, now)) {
        try {
          await this.deleteItem(sellerId, item.id);
          deletedCount++;
        } catch (err) {
          console.warn("Failed to delete expired listing:", item.id, err);
        }
        continue;
      }

      const expiry = resolveExpiryDate(item);
      if (!expiry) continue;

      const hoursUntilExpiry =
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

      let newStatus: ItemStatus = item.status;

      if (hoursUntilExpiry <= 6) {
        newStatus = "expiring";
      } else {
        newStatus = "fresh";
      }

      if (item.quantity - (item.sold || 0) <= 0) {
        newStatus = "sold_out";
      }

      if (newStatus !== item.status) {
        await this.updateItem(sellerId, item.id, { status: newStatus });
      }
    }

    return deletedCount;
  }
}

/** True when a listing should appear on seller/buyer active feeds. */
export function isActiveListing(
  item: InventoryItem,
  now: Date = new Date(),
): boolean {
  if (item.status === "expired" || item.status === "sold_out") return false;

  const remaining = (item.quantity ?? 0) - (item.sold ?? 0);
  if (remaining <= 0) return false;

  if (isListingExpired(item, now)) return false;

  return (
    item.status === "active" ||
    item.status === "fresh" ||
    item.status === "expiring"
  );
}

export const inventoryService = new InventoryService();

class OrderService {
  async getOrders(sellerId: string): Promise<Order[]> {
    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const snapshot = await getDocs(ordersRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  }

  async updateOrderStatus(
    sellerId: string,
    orderId: string,
    status: Order["status"],
  ): Promise<void> {
    await syncSellerAndBuyerOrderStatus(sellerId, orderId, status);
  }
}

export const orderService = new OrderService();
