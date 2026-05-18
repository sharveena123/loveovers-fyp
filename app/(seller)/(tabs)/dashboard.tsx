import { PredictionScreen } from "@/src/components/dashboard/PredictionScreen";
import { UploadAndTrainScreen } from "@/src/components/dashboard/UploadScreen";
import { Text } from "@/src/components/StyledText";
import {
  DashboardStats,
  getDashboardStats,
} from "@/src/services/firebase/analytics";
import { auth } from "@/src/services/firebase/config";
import {
  InventoryItem,
  inventoryService,
} from "@/src/services/firebase/inventoryServices";
import {
  getUserProfile,
  SellerProfile,
  updateSellerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { Link, router, useFocusEffect } from "expo-router";
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  DollarSign,
  Leaf,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
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
const STAT_CARD_WIDTH = (width - spacing.lg * 2 - spacing.md) / 2;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getHoursUntilExpiry(item: InventoryItem): number {
  if (!item.expiryTime) return 0;
  return Math.max(
    0,
    Math.floor(
      (item.expiryTime.toDate().getTime() - Date.now()) / 1000 / 60 / 60,
    ),
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  change,
  changeColor,
  accentColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  change: string;
  changeColor: string;
  accentColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: accentColor }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statChange, { color: changeColor }]}>{change}</Text>
    </View>
  );
}

function BagCard({ item }: { item: InventoryItem }) {
  const sold = item.sold || 0;
  const remaining = item.quantity - sold;
  const progress = item.quantity > 0 ? (sold / item.quantity) * 100 : 0;
  const hoursLeft = getHoursUntilExpiry(item);
  const isUrgent = hoursLeft <= 2;

  return (
    <View style={styles.bagCard}>
      <View style={styles.bagCardTop}>
        <View style={styles.bagIconWrap}>
          <ShoppingBag size={20} color={colors.primary} />
        </View>
        <View style={styles.bagCardMeta}>
          <Text style={styles.bagName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.bagTags}>
            <View
              style={[
                styles.statusPill,
                isUrgent ? styles.statusPillUrgent : styles.statusPillLive,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isUrgent ? styles.statusPillTextUrgent : styles.statusPillTextLive,
                ]}
              >
                {isUrgent ? `${hoursLeft}h left` : "Live"}
              </Text>
            </View>
            {item.category ? (
              <Text style={styles.bagCategory}>{item.category}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.bagPrice}>RM {item.price}</Text>
      </View>

      <View style={styles.bagStatsRow}>
        <Text style={styles.bagStat}>
          <Text style={styles.bagStatBold}>{sold}</Text> sold
        </Text>
        <View style={styles.bagStatDivider} />
        <Text style={styles.bagStat}>
          <Text style={styles.bagStatBold}>{remaining}</Text> left
        </Text>
        <View style={styles.bagStatDivider} />
        <Text style={styles.bagStat}>
          Expires in <Text style={styles.bagStatBold}>{hoursLeft}h</Text>
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

export default function OwnerDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainedCafeId, setTrainedCafeId] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    bagsSoldToday: 0,
    wasteReduction: 0,
    itemsExpiring: 0,
    revenueChange: 0,
    bagsChange: 0,
    wasteChange: 0,
  });
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);

  const fetchDashboardData = useCallback(async (sellerId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      await inventoryService.updateItemStatuses(sellerId);

      const [dashStats, items] = await Promise.all([
        getDashboardStats(sellerId),
        inventoryService.getInventory(sellerId),
      ]);

      setStats(dashStats);
      setInventory(
        items.filter(
          (item) =>
            item.status === "active" ||
            item.status === "fresh" ||
            item.status === "expiring",
        ),
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      if (!silent) setLoading(false);
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

    try {
      const profile = await getUserProfile(user.uid);

      if (!profile || profile.role !== "seller") {
        Alert.alert("Error", "Seller profile not found", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
        return;
      }

      const seller = profile as SellerProfile;
      setSellerProfile(seller);
      if (seller.cafeId) {
        setTrainedCafeId(seller.cafeId);
      }
      await fetchDashboardData(user.uid);
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile");
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) {
        fetchDashboardData(auth.currentUser.uid, true);
      }
    }, [fetchDashboardData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (auth.currentUser) {
      await fetchDashboardData(auth.currentUser.uid);
    }
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleTrainingComplete = useCallback(async (cafeId: string) => {
    setTrainedCafeId(cafeId);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateSellerProfile(user.uid, { cafeId });
        setSellerProfile((prev) => (prev ? { ...prev, cafeId } : prev));
      } catch (error) {
        console.error("Error saving cafe ID:", error);
      }
    }
  }, []);

  if (loading || !sellerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
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
              <Sparkles size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greeting}>{getGreeting()}</Text>
            </View>
            <Text style={styles.shopName}>{sellerProfile.businessName}</Text>
            <Text style={styles.headerSubtitle}>
              Here&apos;s how your shop is doing today
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.revenueCard}>
            <View style={styles.revenueLeft}>
              <View style={styles.revenueIconWrap}>
                <DollarSign size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.revenueLabel}>Today&apos;s revenue</Text>
                <Text style={styles.revenueValue}>
                  RM {stats.todayRevenue.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.revenueBadge}>
              <TrendingUp size={14} color={colors.success} />
              <Text style={styles.revenueBadgeText}>
                +{stats.revenueChange.toFixed(1)}%
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Package size={20} color={colors.primary} />}
              iconBg={colors.primarySoft}
              value={String(stats.bagsSoldToday)}
              label="Bags sold"
              change={`↗ +${stats.bagsChange.toFixed(1)}%`}
              changeColor={colors.success}
              accentColor={colors.primary}
            />
            <StatCard
              icon={<Leaf size={20} color={colors.success} />}
              iconBg={colors.successSoft}
              value={`${stats.wasteReduction}%`}
              label="Waste reduced"
              change={`↗ +${stats.wasteChange.toFixed(1)}%`}
              changeColor={colors.success}
              accentColor={colors.success}
            />
            <StatCard
              icon={<AlertCircle size={20} color={colors.error} />}
              iconBg={colors.errorSoft}
              value={String(stats.itemsExpiring)}
              label="Expiring soon"
              change="Within 2 hours"
              changeColor={colors.error}
              accentColor={colors.error}
            />
            <StatCard
              icon={<ShoppingBag size={20} color="#7c6a4f" />}
              iconBg="#f5f0e8"
              value={String(inventory.length)}
              label="Active listings"
              change="Live now"
              changeColor={colors.textSoft}
              accentColor="#c4a574"
            />
          </View>

          <Link href="/(seller)/analytics" asChild>
            <TouchableOpacity style={styles.analyticsCard} activeOpacity={0.88}>
              <View style={styles.analyticsIconWrap}>
                <BarChart3 size={22} color={colors.primary} />
              </View>
              <View style={styles.analyticsTextWrap}>
                <Text style={styles.analyticsTitle}>Business analytics</Text>
                <Text style={styles.analyticsSubtitle}>
                  Revenue trends, sales & waste insights
                </Text>
              </View>
              <ChevronRight size={22} color={colors.textSoft} />
            </TouchableOpacity>
          </Link>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active mystery bags</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{inventory.length} live</Text>
              </View>
            </View>

            {inventory.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Package size={32} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No active bags yet</Text>
                <Text style={styles.emptySubtext}>
                  Tap the + button below to add your first mystery bag or item
                </Text>
              </View>
            ) : (
              inventory.map((item) => <BagCard key={item.id} item={item} />)
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI predictions</Text>
              <View style={styles.aiBadge}>
                <Sparkles size={12} color={colors.primary} />
                <Text style={styles.aiBadgeText}>Smart</Text>
              </View>
            </View>
            <View style={styles.aiSection}>
              {!trainedCafeId ? (
                <UploadAndTrainScreen
                  onTrainingComplete={handleTrainingComplete}
                />
              ) : (
                <PredictionScreen
                  key={trainedCafeId}
                  cafeId={trainedCafeId}
                  onModelNotFound={() => setTrainedCafeId(null)}
                  onRetrain={() => setTrainedCafeId(null)}
                />
              )}
            </View>
          </View>
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
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  greeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  shopName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "400",
    lineHeight: 20,
  },
  body: {
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  revenueCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.08)",
  },
  revenueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  revenueIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  revenueLabel: {
    fontSize: 13,
    color: colors.textSoft,
    fontWeight: "500",
    marginBottom: 2,
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  revenueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  revenueBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    width: STAT_CARD_WIDTH,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
    marginBottom: 6,
  },
  statChange: {
    fontSize: 11,
    fontWeight: "600",
  },
  analyticsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  analyticsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsTextWrap: {
    flex: 1,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  analyticsSubtitle: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: "700",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  aiBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  bagCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bagIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bagCardMeta: {
    flex: 1,
    minWidth: 0,
  },
  bagName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  bagTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillLive: {
    backgroundColor: colors.successSoft,
  },
  statusPillUrgent: {
    backgroundColor: colors.errorSoft,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillTextLive: {
    color: colors.success,
  },
  statusPillTextUrgent: {
    color: colors.error,
  },
  bagCategory: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
  },
  bagPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  bagStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  bagStat: {
    fontSize: 12,
    color: colors.textSoft,
  },
  bagStatBold: {
    fontWeight: "700",
    color: colors.text,
  },
  bagStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
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
    paddingHorizontal: spacing.md,
  },
  aiSection: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(106, 60, 0, 0.15)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 320,
  },
});
