import { useAuth } from "@/src/hooks/useAuth";
import {
    deleteNotification,
    getUserNotifications,
    markNotificationAsRead,
    Notification,
} from "@/src/services/firebase/notificationServices";
import { colors, spacing } from "@/src/theme/styles";
import { useFocusEffect } from "expo-router";
import { Bell, Check, X } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface NotificationItemProps {
  notification: Notification & { id: string };
  onPress: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
}

function NotificationItem({
  notification,
  onPress,
  onDelete,
  onMarkRead,
}: NotificationItemProps) {
  const getIconForType = (type: string) => {
    const iconMap: Record<string, string> = {
      inventory_expiry: "⚠️",
      low_stock: "📦",
      items_expired: "❌",
      new_order: "🎉",
      order_canceled: "❌",
      order_pickup: "✅",
      high_demand: "📈",
      mystery_bag_selling: "🔥",
      no_mystery_bags: "⚠️",
      ai_surplus_warning: "⚠️",
      ai_production_reduce: "📊",
      ai_weekend_spike: "📈",
      ai_sales_trend: "📉",
      daily_report: "📊",
      top_item: "💡",
      waste_increased: "⚠️",
      customer_message: "💬",
      support_issue: "🚨",
      new_bakery_nearby: "📍",
      popular_deal_nearby: "🔥",
      expiring_items_nearby: "🚨",
      order_confirmed: "🛒",
      pickup_starts: "⏰",
      order_ready: "📦",
      order_canceled_buyer: "❌",
      mystery_bag_available: "🔥",
      price_drop: "💸",
      limited_offer: "🎯",
      ai_personalized: "🤖",
      ai_weekend_habits: "🍰",
      ai_favorite_bakery: "📊",
      payment_success: "💳",
      refund_processed: "💸",
      seller_replied: "💬",
      pickup_time_updated: "⚠️",
    };
    return iconMap[type] || "📢";
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.notificationItemUnread,
      ]}
      onPress={onPress}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationIcon}>
            {getIconForType(notification.type)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.notificationTime}>
              {formatTime(notification.createdAt)}
            </Text>
          </View>
          {!notification.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationBody}>{notification.body}</Text>
      </View>

      <View style={styles.notificationActions}>
        {!notification.read && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
          >
            <Check size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X size={16} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  userRole: "seller" | "buyer";
}

export function NotificationsModal({
  visible,
  onClose,
  userRole,
}: NotificationsModalProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<
    (Notification & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const notifs = await getUserNotifications(user.uid, 50);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (visible) {
        loadNotifications();
      }
    }, [visible, loadNotifications]),
  );

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      Alert.alert("Error", "Failed to mark notification as read");
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) =>
        notifications.find((n) => n.id === notificationId && !n.read)
          ? Math.max(0, prev - 1)
          : prev,
      );
    } catch (error) {
      Alert.alert("Error", "Failed to delete notification");
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={48} color="#BDC3C7" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You&apos;ll see updates here about orders, inventory, and more
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationItem
                notification={item}
                onPress={onClose}
                onDelete={() => handleDelete(item.id)}
                onMarkRead={() => handleMarkAsRead(item.id)}
              />
            )}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C3E50",
  },
  unreadBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: "#7F8C8D",
    fontSize: 14,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#95A5A6",
    marginTop: spacing.sm,
    textAlign: "center",
  },
  notificationItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationItemUnread: {
    backgroundColor: "#F8F9FA",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 12,
    color: "#95A5A6",
  },
  notificationBody: {
    fontSize: 13,
    color: "#34495E",
    marginTop: spacing.sm,
    marginLeft: 28,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  notificationActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
});
