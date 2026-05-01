import { AddBagModal } from "@/src/components/dashboard/AddBagModal";
import { AddItemModal } from "@/src/components/dashboard/AddItemModal";
import { Text } from "@/src/components/StyledText";
import {
  DashboardStats,
  getDashboardStats,
  getWeeklySalesData,
  SalesData,
} from "@/src/services/firebase/analytics";
import { auth } from "@/src/services/firebase/config";
import {
  InventoryItem,
  inventoryService,
} from "@/src/services/firebase/inventoryServices";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { router } from "expo-router";
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Package,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function OwnerDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    bagsSoldToday: 0,
    wasteReduction: 0,
    itemsExpiring: 0,
    revenueChange: 0,
    bagsChange: 0,
    wasteChange: 0,
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"weekly" | "ai">("weekly");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
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

      setSellerProfile(profile as SellerProfile);
      await fetchDashboardData(user.uid);
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile");
    }
  };

  const fetchDashboardData = async (sellerId: string) => {
    setLoading(true);
    try {
      // Update item statuses first to mark expired items
      await inventoryService.updateItemStatuses(sellerId);

      const [dashStats, items, weeklyData] = await Promise.all([
        getDashboardStats(sellerId),
        inventoryService.getInventory(sellerId),
        getWeeklySalesData(sellerId),
      ]);

      setStats(dashStats);
      // Filter items that are active OR fresh (not expired)
      setInventory(
        items.filter(
          (item) =>
            item.status === "active" ||
            item.status === "fresh" ||
            item.status === "expiring",
        ),
      );
      setSalesData(weeklyData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuccess = async () => {
    if (auth.currentUser) {
      await fetchDashboardData(auth.currentUser.uid);
    }
  };

  if (loading || !sellerProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 200 }}
        />
      </SafeAreaView>
    );
  }

  const maxSales = Math.max(...salesData.map((d) => d.sales), 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.shopName}>{sellerProfile.businessName}</Text>
            <Text style={styles.subtitle}>Dashboard & Analytics</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.addButton, styles.addItemButton]}
              onPress={() => setShowAddItemModal(true)}
            >
              <Text style={styles.addButtonText}>+ Item</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addButtonText}>+ Bag</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Revenue */}
          <View style={styles.statCard}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#fff5e6" }]}
            >
              <DollarSign size={24} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>
              RM {stats.todayRevenue.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Today&apos;s Revenue</Text>
            <Text style={[styles.statChange, { color: colors.success }]}>
              ↗ +{stats.revenueChange.toFixed(1)}%
            </Text>
          </View>

          {/* Bags Sold */}
          <View style={styles.statCard}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#f0f0f0" }]}
            >
              <Package size={24} color="#666" />
            </View>
            <Text style={styles.statValue}>{stats.bagsSoldToday}</Text>
            <Text style={styles.statLabel}>Bags Sold Today</Text>
            <Text style={[styles.statChange, { color: colors.success }]}>
              ↗ +{stats.bagsChange.toFixed(1)}%
            </Text>
          </View>

          {/* Waste Reduction */}
          <View style={styles.statCard}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#f0f0f0" }]}
            >
              <BarChart3 size={24} color="#666" />
            </View>
            <Text style={styles.statValue}>{stats.wasteReduction}%</Text>
            <Text style={styles.statLabel}>Waste Reduction</Text>
            <Text style={[styles.statChange, { color: colors.success }]}>
              ↗ +{stats.wasteChange.toFixed(1)}%
            </Text>
          </View>

          {/* Items Expiring */}
          <View style={styles.statCard}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#fee2e2" }]}
            >
              <AlertCircle size={24} color={colors.error} />
            </View>
            <Text style={styles.statValue}>{stats.itemsExpiring}</Text>
            <Text style={styles.statLabel}>Items Expiring</Text>
            <Text style={[styles.statChange, { color: colors.error }]}>
              Within 2 hours
            </Text>
          </View>
        </View>

        {/* Active Mystery Bags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Mystery Bags</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{inventory.length} Live</Text>
            </View>
          </View>

          {inventory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active mystery bags</Text>
              <Text style={styles.emptySubtext}>
                Add your first bag to get started!
              </Text>
            </View>
          ) : (
            inventory.map((item) => (
              <View key={item.id} style={styles.bagCard}>
                <View style={styles.bagHeader}>
                  <Text style={styles.bagName}>{item.name}</Text>
                  <Text style={styles.bagPrice}>RM {item.price}</Text>
                </View>
                <View style={styles.bagInfo}>
                  <Text style={styles.bagDetail}>
                    {item.quantity - (item.sold || 0)}/{item.quantity} sold
                  </Text>
                  <Text style={styles.bagDot}>•</Text>
                  <Text style={styles.bagDetail}>
                    Expires in{" "}
                    {item.expiryTime
                      ? Math.floor(
                          (item.expiryTime.toDate().getTime() - Date.now()) /
                            1000 /
                            60 /
                            60,
                        )
                      : 0}
                    h
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${((item.sold || 0) / item.quantity) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Analytics Tabs */}
        <View style={styles.section}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "weekly" && styles.tabActive]}
              onPress={() => setActiveTab("weekly")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "weekly" && styles.tabTextActive,
                ]}
              >
                Weekly Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "ai" && styles.tabActive]}
              onPress={() => setActiveTab("ai")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "ai" && styles.tabTextActive,
                ]}
              >
                AI Prediction
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chart */}
          <View style={styles.chart}>
            {salesData.length > 0 ? (
              salesData.map((data, index) => (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.barGroup}>
                    <View
                      style={[
                        styles.salesBar,
                        { height: Math.max((data.sales / maxSales) * 150, 2) }, // Minimum 2px
                      ]}
                    />
                    <View
                      style={[
                        styles.wasteBar,
                        { height: Math.max((data.waste / maxSales) * 150, 2) }, // Minimum 2px
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{data.day}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No data available</Text>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {auth.currentUser && (
        <>
          <AddBagModal
            open={showAddModal}
            onOpenChange={setShowAddModal}
            sellerId={auth.currentUser.uid}
            onSuccess={handleAddSuccess}
          />
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            sellerId={auth.currentUser.uid}
            onSuccess={handleAddSuccess}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shopName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  headerButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  addItemButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  addButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    width: (width - spacing.md * 3) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: 8,
  },
  statChange: {
    fontSize: 12,
    fontWeight: "500",
  },
  section: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: "600",
  },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  bagName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  bagPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSoft,
  },
  bagInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  bagDetail: {
    fontSize: 13,
    color: colors.textSoft,
  },
  bagDot: {
    marginHorizontal: spacing.sm,
    color: colors.textSoft,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#f0f0f0",
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
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSoft,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: colors.background,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  chartContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
  },
  barGroup: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginBottom: spacing.sm,
  },
  salesBar: {
    width: 12,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  wasteBar: {
    width: 12,
    backgroundColor: colors.textSoft,
    borderRadius: 2,
  },
  chartLabel: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 4,
  },
});
