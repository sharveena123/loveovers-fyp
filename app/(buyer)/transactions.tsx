import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  BuyerTransaction,
  getBuyerTransactions,
} from "@/src/services/firebase/buyerPayments";
import { colors, spacing } from "@/src/theme/styles";
import { BUYER_ROUTES, goBackToReturn } from "@/src/utils/navigation";
import { router, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Receipt,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type FilterKey = "all" | "payments" | "refunds";

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "succeeded":
      return "Paid";
    case "refund_pending":
      return "Refund pending";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Pending";
  }
}

function TransactionRow({ tx }: { tx: BuyerTransaction }) {
  const isRefund = tx.type === "refund";
  const isPositive = isRefund;

  return (
    <View style={styles.txCard}>
      <View
        style={[
          styles.txIconWrap,
          { backgroundColor: isRefund ? colors.successSoft : colors.primarySoft },
        ]}
      >
        {isRefund ? (
          <ArrowDownLeft size={20} color={colors.success} />
        ) : (
          <ArrowUpRight size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.description}
        </Text>
        <Text style={styles.txSeller} numberOfLines={1}>
          {tx.sellerName}
        </Text>
        <Text style={styles.txMeta}>
          #{tx.orderId.slice(0, 8).toUpperCase()} · {formatDate(tx.createdAt)}
        </Text>
        <View style={styles.txBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isRefund ? "Refund" : paymentStatusLabel(tx.paymentStatus)}
            </Text>
          </View>
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>{tx.orderStatus}</Text>
          </View>
        </View>
      </View>
      <View style={styles.txAmountCol}>
        <Text
          style={[
            styles.txAmount,
            isPositive ? styles.txAmountIn : styles.txAmountOut,
          ]}
        >
          {isPositive ? "+" : "−"}RM{tx.amount.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

export default function BuyerTransactions() {
  const nav = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<BuyerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    try {
      const list = await getBuyerTransactions(user.uid);
      setTransactions(list);
    } catch (e) {
      console.error("Error loading transactions:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setLoading(true);
        load();
      }
    }, [user, load]),
  );

  const filtered = useMemo(() => {
    if (filter === "payments") {
      return transactions.filter((t) => t.type === "payment");
    }
    if (filter === "refunds") {
      return transactions.filter((t) => t.type === "refund");
    }
    return transactions;
  }, [transactions, filter]);

  const totalPaid = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "payment" && t.paymentStatus === "succeeded")
        .reduce((s, t) => s + t.amount, 0),
    [transactions],
  );

  const totalRefunded = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "refund")
        .reduce((s, t) => s + t.amount, 0),
    [transactions],
  );

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading transactions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            goBackToReturn(nav, returnTo, BUYER_ROUTES.profile)
          }
          activeOpacity={0.85}
        >
          <ArrowLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Transaction history</Text>
          <Text style={styles.headerSub}>Payments & refunds</Text>
        </View>
        <View style={styles.headerIcon}>
          <Receipt size={22} color={colors.white} />
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <CreditCard size={18} color={colors.primary} />
          <Text style={styles.summaryValue}>RM{totalPaid.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Total paid</Text>
        </View>
        <View style={styles.summaryCard}>
          <ArrowDownLeft size={18} color={colors.success} />
          <Text style={styles.summaryValue}>RM{totalRefunded.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Refunded</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: "all" as const, label: "All" },
            { key: "payments" as const, label: "Payments" },
            { key: "refunds" as const, label: "Refunds" },
          ] as const
        ).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextOn,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Receipt size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              Your payments and refunds will appear here after you place orders.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/(buyer)/buyerhome")}
            >
              <Text style={styles.emptyBtnText}>Browse deals</Text>
              <ChevronRight size={16} color={colors.white} />
            </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.white,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
  },
  filterChipTextOn: { color: colors.white },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: spacing.sm,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txBody: { flex: 1, minWidth: 0 },
  txTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  txSeller: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  txMeta: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 4,
  },
  txBadges: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  badgeMuted: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeMutedText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "capitalize",
  },
  txAmountCol: { alignItems: "flex-end" },
  txAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
  txAmountOut: { color: colors.text },
  txAmountIn: { color: colors.success },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
