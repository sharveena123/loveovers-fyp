import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import { getBuyerTransactions } from "@/src/services/firebase/buyerPayments";
import { BuyerStats, getBuyerStats } from "@/src/services/firebase/buyerStats";
import { auth } from "@/src/services/firebase/config";
import {
  BuyerProfile as BuyerProfileType,
  getUserProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { formatCo2, formatMeals } from "@/src/utils/impactMetrics";
import { BUYER_ROUTES, pushWithReturn } from "@/src/utils/navigation";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRight,
  CreditCard,
  Edit2,
  HelpCircle,
  Leaf,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  User,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const STAT_W = (width - spacing.lg * 2 - spacing.md) / 2;

function MenuRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.menuRowLeft}>
        <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.menuRowRight}>
        {rightElement}
        {showChevron && onPress ? (
          <ChevronRight size={20} color={colors.textSoft} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: accent }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function BuyerProfile() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<BuyerProfileType | null>(null);
  const [stats, setStats] = useState<BuyerStats | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalRefunded, setTotalRefunded] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);

  const loadProfile = useCallback(async () => {
    const uid = user?.uid ?? auth.currentUser?.uid;
    if (!uid) {
      router.replace("/(auth)/login");
      return;
    }

    try {
      const [userProfile, buyerStats, transactions] = await Promise.all([
        getUserProfile(uid),
        getBuyerStats(uid),
        getBuyerTransactions(uid),
      ]);

      if (userProfile && userProfile.role === "buyer") {
        setProfile(userProfile as BuyerProfileType);
      }
      setStats(buyerStats);

      let paid = 0;
      let refunded = 0;
      let pending = 0;
      for (const tx of transactions) {
        if (tx.type === "payment" && tx.paymentStatus === "succeeded") {
          paid += tx.amount;
        }
        if (tx.type === "refund") {
          refunded += tx.amount;
        }
        if (
          tx.type === "payment" &&
          (tx.paymentStatus === "refund_pending" ||
            tx.refundStatus === "requested" ||
            tx.refundStatus === "processing")
        ) {
          pending += 1;
        }
      }
      setTotalPaid(paid);
      setTotalRefunded(refunded);
      setPendingRefunds(pending);
    } catch (error) {
      console.error("Error loading buyer profile:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
            router.replace("/");
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const displayName =
    profile?.fullName || user?.displayName || "Food rescuer";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || "—";

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <View style={styles.greetingRow}>
              <Sparkles size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greeting}>Your account</Text>
            </View>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileCard}>
            <View style={styles.profileCardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
              </View>
              <View style={styles.profileMeta}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                      pushWithReturn(
                        router,
                        "/(buyer)/buyereditprofile",
                        BUYER_ROUTES.profile,
                      )
                    }
                  >
                    <Edit2 size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.memberBadge}>
                  <ShoppingBag size={12} color={colors.primary} />
                  <Text style={styles.memberBadgeText}>Buyer · LoveOvers</Text>
                </View>
              </View>
            </View>

            <View style={styles.contactList}>
              <View style={styles.contactRow}>
                <User size={15} color={colors.primary} />
                <Text style={styles.contactText}>{email || "No email"}</Text>
              </View>
              <View style={styles.contactRow}>
                <Phone size={15} color={colors.primary} />
                <Text style={styles.contactText}>{phone}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Your activity</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Package size={18} color={colors.primary} />}
              iconBg={colors.primarySoft}
              value={String(stats?.ordersCount ?? 0)}
              label="Orders"
              accent={colors.primary}
            />
            <StatCard
              icon={<TrendingDown size={18} color={colors.success} />}
              iconBg={colors.successSoft}
              value={`RM ${(stats?.moneySaved ?? 0).toFixed(0)}`}
              label="Money saved"
              accent={colors.success}
            />
            <StatCard
              icon={<Leaf size={18} color={colors.success} />}
              iconBg={colors.successSoft}
              value={formatCo2(stats?.co2Saved ?? 0)}
              label="CO₂ avoided"
              accent={colors.success}
            />
            <StatCard
              icon={<ShoppingBag size={18} color="#c4a574" />}
              iconBg="#f5f0e8"
              value={formatMeals(stats?.mealsRescued ?? 0)}
              label="Meals rescued"
              accent="#c4a574"
            />
          </View>

          <View style={styles.paymentsCard}>
            <View style={styles.paymentsHeader}>
              <CreditCard size={20} color={colors.primary} />
              <Text style={styles.paymentsTitle}>Payments</Text>
              {pendingRefunds > 0 ? (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>
                    {pendingRefunds} refund{pendingRefunds !== 1 ? "s" : ""} pending
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.paymentsStats}>
              <View style={styles.paymentStat}>
                <Text style={styles.paymentStatVal}>
                  RM{totalPaid.toFixed(2)}
                </Text>
                <Text style={styles.paymentStatLbl}>Total spent</Text>
              </View>
              <View style={styles.paymentStatDivider} />
              <View style={styles.paymentStat}>
                <Text style={[styles.paymentStatVal, { color: colors.success }]}>
                  RM{totalRefunded.toFixed(2)}
                </Text>
                <Text style={styles.paymentStatLbl}>Refunded</Text>
              </View>
            </View>
            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.paymentActionBtn}
                onPress={() =>
                  pushWithReturn(
                    router,
                    "/(buyer)/transactions",
                    BUYER_ROUTES.profile,
                  )
                }
                activeOpacity={0.88}
              >
                <Text style={styles.paymentActionText}>Transaction history</Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentActionBtn}
                onPress={() =>
                  pushWithReturn(
                    router,
                    "/(buyer)/refunds",
                    BUYER_ROUTES.profile,
                  )
                }
                activeOpacity={0.88}
              >
                <RotateCcw size={16} color={colors.primary} />
                <Text style={styles.paymentActionText}>Refund processing</Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.impactCard}>
            <View style={styles.impactHeader}>
              <View style={styles.impactIconWrap}>
                <Leaf size={22} color={colors.success} />
              </View>
              <View>
                <Text style={styles.impactTitle}>Your impact</Text>
                <Text style={styles.impactSubtitle}>
                  Thank you for fighting food waste
                </Text>
              </View>
            </View>
            <Text style={styles.impactBody}>
              You&apos;ve rescued {formatMeals(stats?.mealsRescued ?? 0)} meals
              (~{stats?.foodSavedKg ?? 0} kg food) and avoided{" "}
              {formatCo2(stats?.co2Saved ?? 0)} of CO₂. Every order makes a
              difference.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Orders & shopping</Text>
            <View style={styles.card}>
              <MenuRow
                icon={<Package size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="My orders"
                subtitle="Status, pickup & order details"
                onPress={() => router.push("/(buyer)/buyerorders")}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<MapPin size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Explore map"
                subtitle="Find shops near you"
                onPress={() => router.push("/(buyer)/buyermap")}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<MessageSquare size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Messages"
                subtitle="Chat with sellers"
                onPress={() => router.push("/(buyer)/buychat")}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <MenuRow
                icon={<Settings size={20} color="#666" />}
                iconBg="#f0f0f0"
                title="Preferences"
                subtitle="Search radius & app options"
                onPress={() =>
                  pushWithReturn(
                    router,
                    "/(buyer)/buyerpreferences",
                    BUYER_ROUTES.profile,
                  )
                }
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.card}>
              <MenuRow
                icon={<HelpCircle size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Help & support"
                subtitle="FAQs and contact us"
                onPress={() =>
                  pushWithReturn(
                    router,
                    "/(buyer)/support",
                    BUYER_ROUTES.profile,
                  )
                }
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.9}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <LogOut size={20} color={colors.white} />
                <Text style={styles.logoutButtonText}>Log out</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.versionText}>LoveOvers · Buyer app</Text>
          <View style={styles.bottomSpacing} />
        </View>
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
  loadingText: { fontSize: 14, color: colors.textSoft },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -50,
    right: -30,
  },
  headerContent: { zIndex: 1 },
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
  body: {
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  profileCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.primarySoft,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
  },
  profileMeta: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 6,
  },
  userName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  contactList: { gap: spacing.sm },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSoft,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: STAT_W,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
  },
  impactCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(143,151,121,0.3)",
  },
  impactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  impactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  impactSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  impactBody: {
    fontSize: 14,
    color: colors.textSoft,
    lineHeight: 22,
  },
  paymentsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  pendingPill: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E65100",
  },
  paymentsStats: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  paymentStat: {
    flex: 1,
    alignItems: "center",
  },
  paymentStatDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  paymentStatVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  paymentStatLbl: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    marginTop: 4,
  },
  paymentActions: { gap: spacing.sm },
  paymentActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
  },
  paymentActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextWrap: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  menuRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 40 + spacing.md,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  bottomSpacing: { height: spacing.xl },
});
