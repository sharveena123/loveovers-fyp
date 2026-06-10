import { buildBuyerReminders, buildSellerReminders } from "@/src/services/smartReminders";
import type { AvailableBag } from "@/src/services/firebase/buyerInventory";
import { getUserCart } from "@/src/services/firebase/cartServices";
import type { InventoryItem } from "@/src/services/firebase/inventoryServices";
import { getConversations } from "@/src/services/firebase/messagingServices";
import {
  getBuyerOrders,
  getSellerOrders,
} from "@/src/services/firebase/orders";
import type { SmartReminder } from "@/src/types/smartReminders";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

const DISMISS_KEY_PREFIX = "dismissed_smart_reminders_";

function countUnreadMessages(
  conversations: { buyerUnreadCount?: number; sellerUnreadCount?: number }[],
  role: "buyer" | "seller",
): number {
  return conversations.reduce((sum, c) => {
    const count =
      role === "buyer"
        ? (c.buyerUnreadCount ?? 0)
        : (c.sellerUnreadCount ?? 0);
    return sum + count;
  }, 0);
}

export function useSmartReminders(params: {
  role: "buyer" | "seller";
  userId: string | undefined;
  enabled?: boolean;
  bags?: AvailableBag[];
  inventory?: InventoryItem[];
  itemsExpiring?: number;
}) {
  const {
    role,
    userId,
    enabled = true,
    bags = [],
    inventory = [],
    itemsExpiring = 0,
  } = params;

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [computed, setComputed] = useState<SmartReminder[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDismissed = useCallback(async () => {
    if (!userId) return;
    try {
      const raw = await AsyncStorage.getItem(`${DISMISS_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setDismissedIds(parsed);
      }
    } catch {
      setDismissedIds([]);
    }
  }, [userId]);

  const refreshReminders = useCallback(async () => {
    if (!userId || !enabled) {
      setComputed([]);
      return;
    }

    setLoading(true);
    try {
      const conversations = await getConversations(userId, role);
      const unreadMessages = countUnreadMessages(conversations, role);

      if (role === "buyer") {
        const [orders, cartItems] = await Promise.all([
          getBuyerOrders(userId),
          getUserCart(userId),
        ]);
        setComputed(
          buildBuyerReminders({
            orders,
            cartItemCount: cartItems.reduce((n, i) => n + i.quantity, 0),
            bags,
            unreadMessages,
          }),
        );
      } else {
        const orders = (await getSellerOrders(userId)) as {
          status?: string;
        }[];
        const pendingOrderCount = orders.filter(
          (o) => o.status === "pending" || o.status === "confirmed",
        ).length;
        setComputed(
          buildSellerReminders({
            inventory,
            pendingOrderCount,
            itemsExpiring,
            unreadMessages,
          }),
        );
      }
    } catch (error) {
      console.error("Error loading smart reminders:", error);
      setComputed([]);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, role, bags, inventory, itemsExpiring]);

  useEffect(() => {
    loadDismissed();
  }, [loadDismissed]);

  useEffect(() => {
    refreshReminders();
  }, [refreshReminders]);

  const visibleReminders = useMemo(
    () => computed.filter((r) => !dismissedIds.includes(r.id)),
    [computed, dismissedIds],
  );

  const dismissReminder = useCallback(
    async (id: string) => {
      if (!userId) return;
      const next = [...dismissedIds, id];
      setDismissedIds(next);
      try {
        await AsyncStorage.setItem(
          `${DISMISS_KEY_PREFIX}${userId}`,
          JSON.stringify(next),
        );
      } catch {
        // non-critical
      }
    },
    [dismissedIds, userId],
  );

  const clearDismissed = useCallback(async () => {
    if (!userId) return;
    setDismissedIds([]);
    try {
      await AsyncStorage.removeItem(`${DISMISS_KEY_PREFIX}${userId}`);
    } catch {
      // non-critical
    }
    await refreshReminders();
  }, [userId, refreshReminders]);

  return {
    reminders: visibleReminders,
    loading,
    dismissReminder,
    clearDismissed,
    refreshReminders,
  };
}
