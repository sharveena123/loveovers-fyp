import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  canRequestRefund,
  getBuyerRefundOrders,
  getRefundStatus,
  REFUND_REASONS,
  requestBuyerRefund,
} from "@/src/services/firebase/buyerPayments";
import { BuyerOrder } from "@/src/services/firebase/orders";
import { colors, spacing } from "@/src/theme/styles";
import { BUYER_ROUTES, goBackToReturn } from "@/src/utils/navigation";
import { router, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

function refundStatusStyle(status: string) {
  switch (status) {
    case "requested":
      return { bg: "#FFF3E0", text: "#E65100", icon: <Clock size={14} color="#E65100" /> };
    case "processing":
    case "approved":
      return {
        bg: colors.primarySoft,
        text: colors.primary,
        icon: <RefreshCw size={14} color={colors.primary} />,
      };
    case "refunded":
      return {
        bg: colors.successSoft,
        text: colors.success,
        icon: <CheckCircle2 size={14} color={colors.success} />,
      };
    case "rejected":
      return {
        bg: colors.errorSoft,
        text: colors.error,
        icon: <XCircle size={14} color={colors.error} />,
      };
    default:
      return {
        bg: colors.background,
        text: colors.textSoft,
        icon: <Clock size={14} color={colors.textSoft} />,
      };
  }
}

function OrderRefundCard({
  order,
  onRequest,
  submitting,
}: {
  order: BuyerOrder;
  onRequest: () => void;
  submitting: boolean;
}) {
  const refund = getRefundStatus(order);
  const style = refundStatusStyle(refund);
  const eligible = canRequestRefund(order).eligible;
  const preview =
    order.items?.length === 1
      ? order.items[0].name
      : `${order.items?.[0]?.name ?? "Items"} +${(order.items?.length ?? 1) - 1}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {preview}
          </Text>
          <Text style={styles.cardId}>
            #{order.id.slice(0, 8).toUpperCase()} · RM{order.total.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
          {style.icon}
          <Text style={[styles.statusText, { color: style.text }]}>
            {refund === "none" ? "No refund" : refund}
          </Text>
        </View>
      </View>

      {order.refundReason ? (
        <Text style={styles.reasonText}>Reason: {order.refundReason}</Text>
      ) : null}

      {eligible ? (
        <TouchableOpacity
          style={[styles.requestBtn, submitting && styles.btnDisabled]}
          onPress={onRequest}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <RotateCcw size={16} color={colors.white} />
              <Text style={styles.requestBtnText}>Request refund</Text>
            </>
          )}
        </TouchableOpacity>
      ) : refund === "requested" || refund === "processing" ? (
        <Text style={styles.hintText}>
          We&apos;re reviewing your refund. Check back here for updates.
        </Text>
      ) : refund === "refunded" ? (
        <Text style={styles.hintSuccess}>
          Refund of RM{(order.refundedAmount ?? order.total).toFixed(2)} completed.
        </Text>
      ) : null}
    </View>
  );
}

export default function BuyerRefunds() {
  const nav = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOrder, setModalOrder] = useState<BuyerOrder | null>(null);
  const [selectedReason, setSelectedReason] = useState(REFUND_REASONS[0]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const list = await getBuyerRefundOrders(user.uid);
      setOrders(list);
    } catch (e) {
      console.error("Error loading refund orders:", e);
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

  const handleSubmitRefund = async () => {
    if (!user || !modalOrder) return;

    try {
      setSubmittingId(modalOrder.id);
      await requestBuyerRefund(user.uid, modalOrder, selectedReason);
      setModalOrder(null);
      Alert.alert(
        "Refund submitted",
        modalOrder.paymentIntentId?.startsWith("pi_test")
          ? "Your test payment refund was processed automatically."
          : "We'll review your request within 1–3 business days.",
      );
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not submit refund";
      Alert.alert("Refund failed", msg);
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading refunds…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackToReturn(nav, returnTo, BUYER_ROUTES.profile)}
          activeOpacity={0.85}
        >
          <ArrowLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Refund processing</Text>
          <Text style={styles.headerSub}>Request & track refunds</Text>
        </View>
        <View style={styles.headerIcon}>
          <RotateCcw size={22} color={colors.white} />
        </View>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          Eligible orders can be refunded if cancelled, not picked up, or within
          14 days of delivery. Test checkout refunds process automatically.
        </Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderRefundCard
            order={item}
            submitting={submittingId === item.id}
            onRequest={() => {
              setSelectedReason(REFUND_REASONS[0]);
              setModalOrder(item);
            }}
          />
        )}
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
            <RotateCcw size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>No refund activity</Text>
            <Text style={styles.emptyText}>
              Orders eligible for refund will show up here. Check your order
              history for cancelled or unpaid pickups.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => router.push("/(buyer)/buyerorders")}
            >
              <Text style={styles.linkBtnText}>View my orders</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={!!modalOrder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request refund</Text>
              <TouchableOpacity onPress={() => setModalOrder(null)}>
                <X size={22} color={colors.textSoft} />
              </TouchableOpacity>
            </View>
            {modalOrder ? (
              <>
                <Text style={styles.modalAmount}>
                  RM{modalOrder.total.toFixed(2)}
                </Text>
                <Text style={styles.modalLabel}>Why are you requesting a refund?</Text>
                <ScrollView
                  style={styles.reasonList}
                  showsVerticalScrollIndicator={false}
                >
                  {REFUND_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonOption,
                        selectedReason === reason && styles.reasonOptionOn,
                      ]}
                      onPress={() => setSelectedReason(reason)}
                    >
                      <Text
                        style={[
                          styles.reasonOptionText,
                          selectedReason === reason && styles.reasonOptionTextOn,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleSubmitRefund}
                  disabled={!!submittingId}
                >
                  {submittingId ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmBtnText}>Submit refund request</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  infoBanner: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.12)",
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardMeta: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  cardId: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
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
  reasonText: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
    fontStyle: "italic",
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  requestBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  btnDisabled: { opacity: 0.7 },
  hintText: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
  },
  hintSuccess: {
    fontSize: 12,
    color: colors.success,
    fontWeight: "600",
  },
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
  linkBtn: { marginTop: spacing.lg },
  linkBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  reasonList: { maxHeight: 220, marginBottom: spacing.md },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  reasonOptionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reasonOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  reasonOptionTextOn: {
    fontWeight: "700",
    color: colors.primary,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
});
