import { AddBagModal } from "@/src/components/dashboard/AddBagModal";
import { AddItemModal } from "@/src/components/dashboard/AddItemModal";
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
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { router, useFocusEffect } from "expo-router";
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Package,
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

export default function OwnerDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
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
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null,
  );

  const fetchDashboardData = useCallback(async (sellerId: string) => {
    setLoading(true);
    try {
      // Update item statuses first to mark expired items
      await inventoryService.updateItemStatuses(sellerId);

      const [dashStats, items] = await Promise.all([
        getDashboardStats(sellerId),
        inventoryService.getInventory(sellerId),
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
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
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

      setSellerProfile(profile as SellerProfile);
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
        fetchDashboardData(auth.currentUser.uid);
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

  const handleAddSuccess = async () => {
    if (auth.currentUser) {
      await fetchDashboardData(auth.currentUser.uid);
    }
  };

  const handleTrainingComplete = (cafeId: string) => {
    setTrainedCafeId(cafeId);
    Alert.alert("Success", "Model trained! You can now make predictions.");
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

        {/* Analytics Button */}
        <View style={styles.analyticsButtonSection}>
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => router.push("../analytics")}
          >
            <BarChart3 size={20} color={colors.white} />
            <Text style={styles.analyticsButtonText}>
              View Business Analytics
            </Text>
          </TouchableOpacity>
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

        {/* AI Prediction Section */}
        <View style={styles.section}>
          <View style={styles.aiSection}>
            {!trainedCafeId ? (
              <UploadAndTrainScreen
                onTrainingComplete={handleTrainingComplete}
              />
            ) : (
              <PredictionScreen
                cafeId={trainedCafeId}
                onModelNotFound={() => setTrainedCafeId(null)}
                onRetrain={() => setTrainedCafeId(null)}
              />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shopName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.white,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  addItemButton: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "500",
  },
  addButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    width: (width - spacing.md * 3) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: 10,
    fontWeight: "500",
  },
  statChange: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  liveText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "700",
  },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  bagName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  bagPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  bagInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  bagDetail: {
    fontSize: 13,
    color: colors.textSoft,
    fontWeight: "500",
  },
  bagDot: {
    marginHorizontal: spacing.sm,
    color: colors.textSoft,
    fontWeight: "300",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSoft,
  },
  aiSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  analyticsButtonSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  analyticsButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  analyticsButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
