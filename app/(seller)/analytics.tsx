import { Text } from "@/src/components/StyledText";
import {
  DashboardStats,
  getDashboardStats,
} from "@/src/services/firebase/analytics";
import { auth, db } from "@/src/services/firebase/config";
import {
  InventoryItem,
  inventoryService,
} from "@/src/services/firebase/inventoryServices";
import { colors, spacing } from "@/src/theme/styles";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
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

interface WasteItem {
  name: string;
  sold: number;
  waste: number;
  total: number;
}

interface DailyRevenue {
  day: string;
  revenue: number;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [wasteData, setWasteData] = useState<WasteItem[]>([]);
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([]);
  const [kpis, setKpis] = useState({
    totalSales: 0,
    itemsSold: 0,
    wastePercentage: 0,
    revenueSaved: 0,
    topProduct: "N/A",
  });

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        router.back();
        return;
      }

      // Get dashboard stats
      const dashStats = await getDashboardStats(user.uid);
      setStats(dashStats);

      // Get inventory for waste analysis
      const items = await inventoryService.getInventory(user.uid);
      setInventory(items);

      // Calculate waste data
      const waste: WasteItem[] = [];
      let totalWaste = 0;
      let totalSold = 0;
      let maxSold = 0;
      let topProduct = "N/A";

      items.forEach((item: InventoryItem) => {
        const sold = item.sold || 0;
        const waste_count = Math.max(0, (item.quantity || 0) - sold);
        const total = item.quantity || 0;

        if (total > 0) {
          waste.push({
            name: item.name,
            sold,
            waste: waste_count,
            total,
          });
          totalWaste += waste_count;
          totalSold += sold;
          if (sold > maxSold) {
            maxSold = sold;
            topProduct = item.name;
          }
        }
      });

      setWasteData(waste.sort((a, b) => b.waste - a.waste));

      // Calculate KPIs
      const wastePercentage =
        totalSold + totalWaste > 0
          ? (totalSold / (totalSold + totalWaste)) * 100
          : 0;

      // Calculate revenue saved based on actual item prices
      let revenueSaved = 0;
      items.forEach((item: InventoryItem) => {
        const waste_count = Math.max(
          0,
          (item.quantity || 0) - (item.sold || 0),
        );
        const itemPrice = item.price || 15;
        revenueSaved += waste_count * itemPrice;
      });

      setKpis({
        totalSales: dashStats.todayRevenue,
        itemsSold: dashStats.bagsSoldToday,
        wastePercentage: Math.round(wastePercentage),
        revenueSaved,
        topProduct,
      });

      // Fetch actual daily revenue from Firebase
      await fetchDailyRevenue(user.uid);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      Alert.alert("Error", "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDailyRevenue = useCallback(async (sellerId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const revenue: DailyRevenue[] = [];

      // Fetch revenue for last 7 days
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(today);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        try {
          const ordersRef = collection(db, `sellers/${sellerId}/orders`);
          const q = query(
            ordersRef,
            where("purchaseDate", ">=", Timestamp.fromDate(dayStart)),
            where("purchaseDate", "<=", Timestamp.fromDate(dayEnd)),
          );

          const querySnapshot = await getDocs(q);
          let dayRevenue = 0;

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            dayRevenue += data.totalPrice || 0;
          });

          revenue.push({
            day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              dayStart.getDay()
            ],
            revenue: dayRevenue,
          });
        } catch (error) {
          console.error(`Error fetching revenue for day ${i}:`, error);
          revenue.push({
            day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              dayStart.getDay()
            ],
            revenue: 0,
          });
        }
      }

      setRevenueData(revenue);
    } catch (error) {
      console.error("Error in fetchDailyRevenue:", error);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Analytics</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* KPI Summary */}
        <View style={styles.kpiSection}>
          <Text style={styles.sectionTitle}>📊 Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Sales</Text>
              <Text style={styles.kpiValue}>RM {kpis.totalSales}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Items Sold</Text>
              <Text style={styles.kpiValue}>{kpis.itemsSold}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Waste %</Text>
              <Text style={[styles.kpiValue, { color: colors.error }]}>
                {100 - kpis.wastePercentage}%
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Revenue Saved</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>
                RM {kpis.revenueSaved}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Top Product</Text>
              <Text style={styles.kpiValue}>{kpis.topProduct}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Efficiency</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>
                {kpis.wastePercentage}%
              </Text>
            </View>
          </View>
        </View>

        {/* Sales Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            📈 Revenue Trend (Last 7 Days)
          </Text>
          <View style={styles.chartCard}>
            <BarChartComponent data={revenueData} />
          </View>
        </View>

        {/* Waste Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗑️ Waste vs Sold Analysis</Text>
          <View style={styles.chartCard}>
            <WasteChartComponent data={wasteData} />
          </View>
        </View>

        {/* Waste Distribution Pie */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            📊 Waste Distribution by Product
          </Text>
          <View style={styles.chartCard}>
            <WasteDistributionComponent data={wasteData} />
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Insights & Recommendations</Text>
          <InsightsPanel data={wasteData} stats={stats} kpis={kpis} />
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Bar Chart Component
function BarChartComponent({ data }: { data: DailyRevenue[] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barContainer}>
        {data.map((item, index) => {
          const height = (item.revenue / maxRevenue) * 150;
          return (
            <View key={index} style={chartStyles.barWrapper}>
              <View
                style={[
                  chartStyles.bar,
                  { height, backgroundColor: colors.primary },
                ]}
              />
              <Text style={chartStyles.barLabel}>{item.day}</Text>
              <Text style={chartStyles.barValue}>RM {item.revenue}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Waste Chart Component
function WasteChartComponent({ data }: { data: WasteItem[] }) {
  return (
    <View style={chartStyles.container}>
      {data.slice(0, 5).map((item, index) => {
        const total = item.sold + item.waste;
        const soldPercent = (item.sold / total) * 100;
        const wastePercent = (item.waste / total) * 100;

        return (
          <View key={index} style={chartStyles.wasteRow}>
            <Text style={chartStyles.wasteName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={chartStyles.stackedBar}>
              <View
                style={[
                  chartStyles.stackedSegment,
                  { width: `${soldPercent}%`, backgroundColor: colors.success },
                ]}
              />
              <View
                style={[
                  chartStyles.stackedSegment,
                  { width: `${wastePercent}%`, backgroundColor: colors.error },
                ]}
              />
            </View>
            <View style={chartStyles.wasteStats}>
              <Text style={chartStyles.wasteStat}>
                {item.sold}
                <Text style={{ color: colors.textSoft }}> sold</Text>
              </Text>
              <Text style={[chartStyles.wasteStat, { color: colors.error }]}>
                {item.waste}
                <Text style={{ color: colors.textSoft }}> wasted</Text>
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Waste Distribution Component
function WasteDistributionComponent({ data }: { data: WasteItem[] }) {
  const totalWaste = data.reduce((sum, item) => sum + item.waste, 0);
  const colors_list = [
    colors.primary,
    colors.error,
    colors.success,
    colors.primarySoft,
    colors.successSoft,
  ];

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.pieContainer}>
        {data.slice(0, 5).map((item, index) => {
          const percentage =
            totalWaste > 0 ? (item.waste / totalWaste) * 100 : 0;
          const color = colors_list[index % colors_list.length];

          return (
            <View key={index} style={chartStyles.pieLegendItem}>
              <View
                style={[chartStyles.pieLegendColor, { backgroundColor: color }]}
              />
              <Text style={chartStyles.pieLegendLabel}>
                {item.name}: {percentage.toFixed(1)}% ({item.waste} items)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Insights Panel Component
function InsightsPanel({
  data,
  stats,
  kpis,
}: {
  data: WasteItem[];
  stats: DashboardStats | null;
  kpis: any;
}) {
  const insights: string[] = [];

  if (data.length > 0) {
    const topWaste = data[0];
    insights.push(
      `⚠️ Highest waste: ${topWaste.name} (${topWaste.waste} items) - Consider reducing production`,
    );
  }

  if (kpis.wastePercentage < 70) {
    insights.push(
      `📉 Waste efficiency is below target - Aim for 80%+ efficiency`,
    );
  } else {
    insights.push(`✅ Great waste efficiency at ${kpis.wastePercentage}%!`);
  }

  if (stats && stats.itemsExpiring > 3) {
    insights.push(
      `⏰ ${stats.itemsExpiring} items expiring soon - Consider Mystery Bags to clear stock`,
    );
  }

  if (stats) {
    insights.push(
      `📈 Revenue trend: ${stats.revenueChange > 0 ? "📈" : "📉"} ${Math.abs(
        stats.revenueChange,
      ).toFixed(1)}% vs yesterday`,
    );
  }

  return (
    <View style={chartStyles.insightsContainer}>
      {insights.length > 0 ? (
        insights.map((insight, index) => (
          <View key={index} style={chartStyles.insightItem}>
            <Text style={chartStyles.insightText}>{insight}</Text>
          </View>
        ))
      ) : (
        <Text style={chartStyles.insightText}>No insights available yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  kpiSection: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  kpiCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    width: (width - spacing.lg * 3) / 2,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "600",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});

const chartStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  barContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 200,
    marginBottom: spacing.lg,
  },
  barWrapper: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    width: 24,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  barValue: {
    fontSize: 10,
    color: colors.textSoft,
    fontWeight: "600",
  },
  wasteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  wasteName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    width: 60,
  },
  stackedBar: {
    height: 24,
    flex: 1,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  stackedSegment: {
    height: "100%",
  },
  wasteStats: {
    width: 80,
    alignItems: "flex-end",
  },
  wasteStat: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  pieContainer: {
    gap: spacing.md,
  },
  pieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pieLegendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  pieLegendLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  insightsContainer: {
    gap: spacing.md,
  },
  insightItem: {
    backgroundColor: "rgba(106, 60, 0, 0.08)",
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
  },
  insightText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
});
