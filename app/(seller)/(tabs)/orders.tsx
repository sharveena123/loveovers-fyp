import { Text, TextInput } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { Order, orderService } from "@/src/services/firebase/inventoryServices";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { router, useFocusEffect } from "expo-router";
import {
  CheckCircle2,
  Clock,
  Package,
  Phone,
  Search,
  ShoppingBag,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type FilterStatus = "all" | "pending" | "ready" | "completed";

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Done" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function getStatusStyle(status: Order["status"]) {
  switch (status) {
    case "pending":
      return {
        bg: "#1a1a1a",
        text: colors.white,
        icon: <Clock size={12} color={colors.white} />,
      };
    case "ready":
    case "confirmed":
      return {
        bg: colors.primary,
        text: colors.white,
        icon: <CheckCircle2 size={12} color={colors.white} />,
      };
    case "completed":
      return {
        bg: colors.successSoft,
        text: colors.success,
        icon: <CheckCircle2 size={12} color={colors.success} />,
      };
    case "cancelled":
      return {
        bg: colors.errorSoft,
        text: colors.error,
        icon: <X size={12} color={colors.error} />,
      };
    default:
      return {
        bg: colors.border,
        text: colors.textSoft,
        icon: <Clock size={12} color={colors.textSoft} />,
      };
  }
}

function formatOrderTime(createdAt: Order["createdAt"]) {
  if (!createdAt) return "N/A";
  return new Date(createdAt.toDate()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function OrderCard({
  order,
  onMarkReady,
  onCancel,
}: {
  order: Order;
  onMarkReady: () => void;
  onCancel: () => void;
}) {
  const statusStyle = getStatusStyle(order.status);
  const itemLabel =
    order.mysteryBag ||
    order.items?.map((i) => i.name).join(", ") ||
    "Order items";

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        <View style={styles.customerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(order.customerName)}
            </Text>
          </View>
          <View style={styles.customerMeta}>
            <Text style={styles.customerName}>{order.customerName}</Text>
            <Text style={styles.orderId}>#{order.orderId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          {statusStyle.icon}
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.orderItemRow}>
        <View style={styles.orderItemIcon}>
          <ShoppingBag size={18} color={colors.primary} />
        </View>
        <View style={styles.orderItemInfo}>
          <Text style={styles.orderItemLabel}>Items</Text>
          <Text style={styles.orderItemName} numberOfLines={2}>
            {itemLabel}
          </Text>
        </View>
        <Text style={styles.orderTotal}>RM{order.total.toFixed(2)}</Text>
      </View>

      <View style={styles.orderMetaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Pickup</Text>
          <Text style={styles.metaValue}>{order.pickupTime || "—"}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Ordered</Text>
          <Text style={styles.metaValue}>
            {formatOrderTime(order.createdAt)}
          </Text>
        </View>
      </View>

      <View style={styles.phoneRow}>
        <Phone size={15} color={colors.primary} />
        <Text style={styles.phoneText}>{order.customerPhone}</Text>
      </View>

      {order.status === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.readyButton}
            onPress={onMarkReady}
            activeOpacity={0.88}
          >
            <CheckCircle2 size={16} color={colors.white} />
            <Text style={styles.readyButtonText}>Mark as ready</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.88}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchOrders = useCallback(async (sellerId: string) => {
    try {
      const fetchedOrders = await orderService.getOrders(sellerId);
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      Alert.alert("Error", "Failed to load orders");
    }
  }, []);

  const checkAuthAndLoadData = useCallback(async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Error", "Please login to continue", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
      return;
    }

    setLoading(true);
    try {
      const profile = await getUserProfile(user.uid);

      if (!profile || profile.role !== "seller") {
        Alert.alert("Error", "Seller profile not found", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
        return;
      }

      setSellerProfile(profile as SellerProfile);
      await fetchOrders(user.uid);
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [fetchOrders]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) {
        fetchOrders(auth.currentUser.uid);
      }
    }, [fetchOrders]),
  );

  useEffect(() => {
    let filtered = orders;

    if (activeFilter !== "all") {
      filtered = filtered.filter((order) => order.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.customerName.toLowerCase().includes(q) ||
          order.orderId.toLowerCase().includes(q),
      );
    }

    setFilteredOrders(filtered);
  }, [orders, activeFilter, searchQuery]);

  const handleRefresh = useCallback(async () => {
    if (!auth.currentUser) return;
    setRefreshing(true);
    await fetchOrders(auth.currentUser.uid);
    setRefreshing(false);
  }, [fetchOrders]);

  const handleMarkAsReady = async (orderId: string) => {
    if (!auth.currentUser) return;

    try {
      await orderService.updateOrderStatus(
        auth.currentUser.uid,
        orderId,
        "ready",
      );
      await fetchOrders(auth.currentUser.uid);
      Alert.alert("Success", "Order marked as ready");
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "Failed to update order");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!auth.currentUser) return;

    Alert.alert("Cancel order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await orderService.updateOrderStatus(
              auth.currentUser!.uid,
              orderId,
              "cancelled",
            );
            await fetchOrders(auth.currentUser!.uid);
            Alert.alert("Success", "Order cancelled");
          } catch (error) {
            console.error("Error cancelling order:", error);
            Alert.alert("Error", "Failed to cancel order");
          }
        },
      },
    ]);
  };

  const getStatusCount = (status: "pending" | "ready" | "completed") =>
    orders.filter((order) => order.status === status).length;

  if (loading || !sellerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingCount = getStatusCount("pending");
  const readyCount = getStatusCount("ready");
  const completedCount = getStatusCount("completed");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerDecor} />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Orders</Text>
            <Text style={styles.headerSubtitle}>
              {orders.length} total · {pendingCount} need action
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer or order ID…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSoft}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                <X size={18} color={colors.textSoft} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardPending]}>
              <View style={[styles.statIconWrap, { backgroundColor: "#f0f0f0" }]}>
                <Clock size={18} color={colors.text} />
              </View>
              <Text style={styles.statNumber}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, styles.statCardReady]}>
              <View
                style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}
              >
                <Package size={18} color={colors.primary} />
              </View>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {readyCount}
              </Text>
              <Text style={styles.statLabel}>Ready</Text>
            </View>
            <View style={[styles.statCard, styles.statCardDone]}>
              <View
                style={[styles.statIconWrap, { backgroundColor: colors.successSoft }]}
              >
                <CheckCircle2 size={18} color={colors.success} />
              </View>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {completedCount}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTERS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              const count =
                key === "all"
                  ? orders.length
                  : getStatusCount(key as "pending" | "ready" | "completed");

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveFilter(key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.filterCount,
                        isActive && styles.filterCountActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterCountText,
                          isActive && styles.filterCountTextActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Package size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery.trim()
                  ? "Try a different search term"
                  : "New orders will show up here when customers place them"}
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onMarkReady={() => handleMarkAsReady(order.id!)}
                onCancel={() => handleCancelOrder(order.id!)}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSoft,
    fontWeight: "500",
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 8,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerContent: {
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  body: {
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardPending: {
    borderTopWidth: 3,
    borderTopColor: colors.text,
  },
  statCardReady: {
    borderTopWidth: 3,
    borderTopColor: colors.primary,
  },
  statCardDone: {
    borderTopWidth: 3,
    borderTopColor: colors.success,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
  },
  filterScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  filterCount: {
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSoft,
  },
  filterCountTextActive: {
    color: colors.white,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  customerMeta: {
    flex: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  orderId: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  orderItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  orderItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderItemLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    marginBottom: 2,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  orderTotal: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  orderMetaGrid: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaCell: {
    flex: 1,
    alignItems: "center",
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  phoneText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  readyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  readyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSoft,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    marginTop: spacing.sm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 20,
  },
});
