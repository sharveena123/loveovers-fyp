import { Text, TextInput } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import { BuyerOrder, getBuyerOrders } from "@/src/services/firebase/orders";
import { colors, spacing } from "@/src/theme/styles";
import { generateAndShareOrderReceipt } from "@/src/utils/orderReceipt";
import { router, useFocusEffect } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type FilterKey = "all" | "pending" | "active" | "completed" | "cancelled";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function getStatusStyle(status: BuyerOrder["orderStatus"]) {
  switch (status) {
    case "pending":
      return {
        bg: "#FFF3E0",
        text: "#E65100",
        icon: <Clock size={12} color="#E65100" />,
      };
    case "ready":
      return {
        bg: colors.successSoft,
        text: colors.success,
        icon: <CheckCircle2 size={12} color={colors.success} />,
      };
    case "confirmed":
    case "processing":
      return {
        bg: colors.primarySoft,
        text: colors.primary,
        icon: <Package size={12} color={colors.primary} />,
      };
    case "shipped":
      return {
        bg: "#E3F2FD",
        text: "#1565C0",
        icon: <ShoppingBag size={12} color="#1565C0" />,
      };
    case "delivered":
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

function formatDate(date: BuyerOrder["createdAt"]) {
  if (!date) return "—";
  const d =
    date instanceof Date
      ? date
      : typeof date === "object" && "toDate" in date
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as string);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesFilter(order: BuyerOrder, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "pending") return order.orderStatus === "pending";
  if (filter === "active") {
    return ["ready", "confirmed", "processing", "shipped"].includes(
      order.orderStatus,
    );
  }
  if (filter === "completed") return order.orderStatus === "delivered";
  if (filter === "cancelled") return order.orderStatus === "cancelled";
  return true;
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function OrderCard({ order }: { order: BuyerOrder }) {
  const [receiptLoading, setReceiptLoading] = useState(false);
  const statusStyle = getStatusStyle(order.orderStatus);
  const sellerName = order.items[0]?.sellerName || "Seller";
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const itemPreview =
    order.items.length === 1
      ? order.items[0].name
      : `${order.items[0]?.name ?? "Items"} +${order.items.length - 1} more`;
  const isCompleted = order.orderStatus === "delivered";

  const handleDownloadReceipt = async () => {
    setReceiptLoading(true);
    try {
      await generateAndShareOrderReceipt(order);
    } catch (error) {
      console.error("Receipt generation failed:", error);
      Alert.alert(
        "Could not generate receipt",
        "Please try again in a moment.",
      );
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        <View style={styles.sellerRow}>
          <View style={styles.sellerAvatar}>
            <Store size={18} color={colors.primary} />
          </View>
          <View style={styles.sellerMeta}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {sellerName}
            </Text>
            <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          {statusStyle.icon}
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {order.orderStatus}
          </Text>
        </View>
      </View>

      <View style={styles.orderItemRow}>
        <View style={styles.orderItemIcon}>
          <ShoppingBag size={18} color={colors.primary} />
        </View>
        <View style={styles.orderItemInfo}>
          <Text style={styles.orderItemLabel}>
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.orderItemName} numberOfLines={2}>
            {itemPreview}
          </Text>
        </View>
        <Text style={styles.orderTotal}>RM{order.total.toFixed(2)}</Text>
      </View>

      <View style={styles.orderMetaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Ordered</Text>
          <Text style={styles.metaValue}>{formatDate(order.createdAt)}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Payment</Text>
          <Text
            style={[
              styles.metaValue,
              order.paymentStatus === "failed" && { color: colors.error },
              order.paymentStatus === "succeeded" && { color: colors.success },
            ]}
          >
            {order.paymentStatus}
          </Text>
        </View>
      </View>

      {order.paymentStatus === "failed" && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={colors.error} />
          <Text style={styles.errorText}>
            Payment failed — contact support if you were charged
          </Text>
        </View>
      )}

      {isCompleted ? (
        <TouchableOpacity
          style={styles.receiptBtn}
          onPress={handleDownloadReceipt}
          disabled={receiptLoading}
          activeOpacity={0.85}
        >
          {receiptLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Download size={18} color={colors.primary} />
          )}
          <Text style={styles.receiptBtnText}>
            {receiptLoading ? "Generating receipt…" : "Download digital receipt"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function BuyerOrders() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const userOrders = await getBuyerOrders(user.uid);
      setOrders(userOrders);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setLoading(true);
        loadOrders().finally(() => setLoading(false));
      }
    }, [user, loadOrders]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    let list = orders.filter((o) => matchesFilter(o, activeFilter));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.items.some(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.sellerName.toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [orders, activeFilter, searchQuery]);

  const pendingCount = orders.filter((o) => o.orderStatus === "pending").length;
  const activeCount = orders.filter((o) =>
    ["ready", "confirmed", "processing", "shipped"].includes(o.orderStatus),
  ).length;
  const completedCount = orders.filter(
    (o) => o.orderStatus === "delivered",
  ).length;

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <View style={styles.greetingRow}>
              <Sparkles size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greeting}>Purchases</Text>
            </View>
            <Text style={styles.headerTitle}>My orders</Text>
            <Text style={styles.headerSubtitle}>
              {orders.length} total
              {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push("/(buyer)/buyercart")}
          >
            <ShoppingCart size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: "#E65100" }]}>
            {pendingCount}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {activeCount}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {completedCount}
          </Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Search size={18} color={colors.textSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders or shops..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSoft}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={18} color={colors.textSoft} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onPress={() => setActiveFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={styles.orderList}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Package size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {orders.length === 0 ? "No orders yet" : "No matching orders"}
            </Text>
            <Text style={styles.emptyText}>
              {orders.length === 0
                ? "Rescue surplus food from nearby cafés — your orders will show up here."
                : "Try a different filter or search term."}
            </Text>
            {orders.length === 0 && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/(buyer)/buyerhome")}
              >
                <Text style={styles.emptyBtnText}>Browse deals</Text>
                <ChevronRight size={18} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textSoft },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 1,
  },
  headerContent: { flex: 1 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    fontWeight: "500",
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSoft,
    fontWeight: "600",
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 14,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  filterBar: {
    flexShrink: 0,
    minHeight: 52,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    zIndex: 2,
    elevation: 2,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: "center",
  },
  orderList: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  filterChipTextActive: { color: colors.white },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerMeta: { flex: 1, minWidth: 0 },
  sellerName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  orderId: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
    fontWeight: "600",
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
    textTransform: "capitalize",
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  orderItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  orderItemInfo: { flex: 1 },
  orderItemLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 19,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  orderMetaGrid: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: "hidden",
  },
  metaCell: {
    flex: 1,
    padding: spacing.sm,
    alignItems: "center",
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.textSoft,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    textTransform: "capitalize",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    fontWeight: "600",
    lineHeight: 17,
  },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  receiptBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
});
