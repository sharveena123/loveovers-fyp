import { Text } from "@/src/components/StyledText";
import { DatasetAnalyticsBundle } from "@/src/ai/types";
import { AI_API_BASE_URL } from "@/src/ai/api";
import {
  loadDatasetAnalytics,
  loadFirebaseOnlyAnalytics,
} from "@/src/services/ai/datasetAnalytics";
import { auth } from "@/src/services/firebase/config";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { goBackToReturn, SELLER_ROUTES } from "@/src/utils/navigation";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronRight,
  Database,
  Info,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import Svg, { Circle, G, Line as SvgLine } from "react-native-svg";

const SCATTER_COLORS = [
  colors.primary,
  colors.success,
  colors.error,
  "#C4A77D",
  "#8B6914",
  "#5D4037",
  "#7B9E6B",
  "#B5651D",
];

/** Keep line + dot colours aligned with legend labels for dual-series charts. */
const DUAL_LINE_SERIES = {
  primary: {
    color: colors.primary,
    label: "Actually sold",
  },
  secondary: {
    color: colors.success,
    label: "Expected to sell",
  },
} as const;

const { width: SCREEN_W } = Dimensions.get("window");
/** Body padding + chart card padding on each side. */
const CHART_W = SCREEN_W - spacing.lg * 2 - spacing.md * 2;
const LINE_POINT_SPACING = 76;
const LINE_CHART_HEIGHT = 228;
const LINE_X_AXIS_LABEL_HEIGHT = 54;
/** Room so the first/last date labels are not clipped at chart edges. */
const LINE_CHART_START_MARGIN = 36;
const LINE_CHART_END_MARGIN = 24;
const LINE_INITIAL_SPACING = 44;

type ChartDateParts = {
  weekday: string;
  day: string;
  month: string;
  full: string;
};

function getChartDateParts(dateKey: string): ChartDateParts {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { weekday: "", day: dateKey, month: "", full: dateKey };
  }
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const weekday = weekdays[d.getDay()];
  const day = String(d.getDate());
  const month = months[d.getMonth()];
  return {
    weekday,
    day,
    month,
    full: `${weekday} ${day} ${month}`,
  };
}

function lineChartWidth(pointCount: number): number {
  return Math.max(
    CHART_W,
    pointCount * LINE_POINT_SPACING +
      LINE_CHART_START_MARGIN +
      LINE_CHART_END_MARGIN +
      32,
  );
}

function lineDataWithDateLabel(dateKey: string, value: number) {
  const parts = getChartDateParts(dateKey);
  return {
    value,
    label: parts.full,
    labelComponent: () => <ChartDateAxisLabel dateKey={dateKey} />,
  };
}

function shortAxisLabel(text: string, max = 8): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function getSalesTrendInsight(
  points: DatasetAnalyticsBundle["salesOverTime"],
): string {
  if (points.length === 0) {
    return "This line shows how much money you earned each day. Add dates to your sales file to fill it in.";
  }
  if (points.length === 1) {
    return `You earned RM ${points[0].sales.toFixed(0)} on ${points[0].label}. More days will reveal whether earnings are trending up or down.`;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = last.sales - prev.sales;
  const direction =
    delta > 0 ? "went up" : delta < 0 ? "went down" : "stayed flat";
  const peak = points.reduce((best, p) => (p.sales > best.sales ? p : best), points[0]);
  return `Daily earnings ${direction} on ${last.label} (RM ${last.sales.toFixed(0)}). Your best day was ${peak.label} at RM ${peak.sales.toFixed(0)}. The green line tracks order volume (scaled for comparison).`;
}

function getTopSellerInsight(
  items: DatasetAnalyticsBundle["topSellingItems"],
): string {
  if (items.length === 0) {
    return "Bars show how many units of each product sold. Your top sellers deserve more shelf space and fresher batches.";
  }
  const top = items[0];
  return `${top.itemName} leads with ${top.sold} units sold. Keep this stocked on busy days — it drives RM ${top.revenue.toFixed(0)} in revenue.`;
}

function getRevenueInsight(
  categories: DatasetAnalyticsBundle["revenueByCategory"],
): string {
  if (categories.length === 0) {
    return "This chart ranks products by total money earned, not just units sold. Higher bars mean more revenue for your shop.";
  }
  const top = categories.reduce(
    (best, c) => (c.value > best.value ? c : best),
    categories[0],
  );
  return `${top.label} brings in the most money (RM ${top.value.toFixed(0)}). Focus promotions and freshness on high-earning items.`;
}

function getHeatmapInsight(cells: DatasetAnalyticsBundle["heatmap"]): string {
  if (cells.length === 0) {
    return "Darker cells mean more orders at that day and time. Use this to plan when to bake fresh batches and staff your counter.";
  }
  const busiest = cells.reduce(
    (best, c) => (c.orders > best.orders ? c : best),
    cells[0],
  );
  return `Your busiest slot is ${busiest.day} ${busiest.time.toLowerCase()} with ${busiest.orders} orders. Schedule more baking before peak times.`;
}

function getWasteStackInsight(
  items: DatasetAnalyticsBundle["wasteAnalysis"],
): string {
  if (items.length === 0) {
    return "Green shows what customers bought; red is what you made but did not sell. Aim for more green and less red on every product.";
  }
  const worst = items.reduce(
    (best, w) => (w.waste > best.waste ? w : best),
    items[0],
  );
  return `${worst.itemName} has the most leftovers (${worst.waste} units). Try baking less, listing mystery bags, or running smart pricing closer to closing.`;
}

function getWastePieInsight(
  items: DatasetAnalyticsBundle["wasteAnalysis"],
): string {
  if (items.length === 0) {
    return "Each slice is one product's share of total leftovers. A large slice means that item is a priority for waste reduction.";
  }
  const totalWaste = items.reduce((sum, w) => sum + w.waste, 0) || 1;
  const top = items.reduce(
    (best, w) => (w.waste > best.waste ? w : best),
    items[0],
  );
  const share = ((top.waste / totalWaste) * 100).toFixed(0);
  return `${top.itemName} accounts for about ${share}% of all leftovers. Cutting waste here has the biggest impact on your margins.`;
}

function getSurplusTrendInsight(
  points: DatasetAnalyticsBundle["surplusTrend"],
): string {
  if (points.length === 0) {
    return "This tracks unsold items over time. A downward slope means you are matching supply to demand better.";
  }
  if (points.length === 1) {
    const day = getChartDateParts(points[0].date).full;
    return `${points[0].surplus} items were left over on ${day}. More history will show if waste is improving.`;
  }
  const last = points[points.length - 1];
  const first = points[0];
  const improved = last.surplus < first.surplus;
  const range = `${getChartDateParts(first.date).full} → ${getChartDateParts(last.date).full}`;
  return improved
    ? `From ${range}, leftovers dropped from ${first.surplus} to ${last.surplus} — your planning is improving.`
    : `From ${range}, leftovers rose from ${first.surplus} to ${last.surplus}. Review bake quantities on slower days.`;
}

function getScatterInsight(
  points: DatasetAnalyticsBundle["scatterData"],
): string {
  if (points.length === 0) {
    return "Each dot is one product. Dots on the dashed line sold almost everything you made; dots below the line mean you baked too much.";
  }
  const overBaked = points.filter((p) => p.prepared > 0 && p.sold / p.prepared < 0.7);
  if (overBaked.length === 0) {
    return "Most products sit near the ideal line — you are matching bake amounts to demand well.";
  }
  const names = overBaked
    .slice(0, 2)
    .map((p) => p.item)
    .join(" and ");
  return `${names} ${overBaked.length > 1 ? "are" : "is"} baked well above what sells. Reduce batch sizes or list surplus earlier.`;
}

function getForecastInsight(
  forecasts: DatasetAnalyticsBundle["itemForecasts"],
): string {
  if (!forecasts || forecasts.length === 0) {
    return "Suggested bake amounts come from your sales history. Upload a sales file on the dashboard to unlock personalised quantities.";
  }
  const total = forecasts.reduce((sum, f) => sum + f.predicted, 0);
  const top = forecasts.reduce(
    (best, f) => (f.predicted > best.predicted ? f : best),
    forecasts[0],
  );
  return `We suggest baking about ${total} items today. Make the most of ${top.item} (${top.predicted} units) — it is expected to sell strongly.`;
}

function getActualVsPredictedInsight(
  points: DatasetAnalyticsBundle["actualVsPredicted"],
): string {
  if (points.length === 0) {
    return "Brown is what actually sold; green is what we expected. Each point is a calendar day from your sales file — only days with data appear, not every weekday.";
  }
  const rangeHint =
    points.length === 1
      ? `Showing ${points[0].label} only.`
      : `Showing ${points.length} days (${points[0].label} → ${points[points.length - 1].label}). Days without sales records are skipped.`;
  const totals = points.reduce(
    (acc, p) => ({
      actual: acc.actual + p.actual,
      predicted: acc.predicted + p.predicted,
    }),
    { actual: 0, predicted: 0 },
  );
  const diff = totals.actual - totals.predicted;
  if (Math.abs(diff) < totals.predicted * 0.05) {
    return `${rangeHint} Actual sales closely match predictions — your sales patterns are stable and forecasts are reliable.`;
  }
  return diff > 0
    ? `${rangeHint} You sold ${diff.toFixed(0)} more items than expected overall — demand may be growing; consider baking slightly more.`
    : `${rangeHint} You sold ${Math.abs(diff).toFixed(0)} fewer than expected — trim bake quantities to cut waste.`;
}

function getFunnelInsight(stages: DatasetAnalyticsBundle["funnel"]): string {
  if (stages.length < 2) {
    return "This funnel shows how items move from kitchen to customer. Wide bars at the top and narrow bars below highlight where stock is lost.";
  }
  const made = stages[0]?.count ?? 1;
  const sold = stages.find((s) => s.stage.toLowerCase().includes("sold"))?.count ?? stages[stages.length - 2]?.count ?? 0;
  const rate = made > 0 ? ((sold / made) * 100).toFixed(0) : "0";
  return `About ${rate}% of what you make reaches customers. The gap between stages is surplus — shrinking it means less waste and more revenue.`;
}

type AnalyticsTab = "overview" | "sales" | "waste" | "planning";

const ANALYTICS_TABS: { key: AnalyticsTab; label: string; hint: string }[] = [
  { key: "overview", label: "Summary", hint: "Quick numbers and tips" },
  { key: "sales", label: "Sales", hint: "What sells and when" },
  { key: "waste", label: "Leftovers", hint: "What did not sell" },
  { key: "planning", label: "Bake plan", hint: "How much to make" },
];

const KPI_HELP: Record<string, string> = {
  revenue:
    "Total money earned from items sold in your sales history.",
  sold: "How many individual items customers bought.",
  waste: "Share of food you made but did not sell.",
  conversion: "How much of what you baked actually sold.",
  avg: "Average price per item sold.",
  top: "Your most popular product right now.",
};

export default function Analytics() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const handleBack = () =>
    goBackToReturn(router, returnTo, SELLER_ROUTES.profile);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bundle, setBundle] = useState<DatasetAnalyticsBundle | null>(null);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [cafeName, setCafeName] = useState("");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [selectedTopItem, setSelectedTopItem] = useState<string | null>(null);
  const [selectedHeatKey, setSelectedHeatKey] = useState<string | null>(null);
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        handleBack();
        return;
      }
      const profile = (await getUserProfile(user.uid)) as SellerProfile | null;
      const id = profile?.cafeId ?? null;
      setCafeId(id);
      setCafeName(profile?.businessName ?? "Your café");

      const business = profile?.businessName ?? "Your café";

      if (!id) {
        const live = await loadFirebaseOnlyAnalytics(user.uid, business);
        if (!live) {
          console.warn(
            "[analytics] No cafeId and no inventory/orders for live charts.",
          );
        }
        setBundle(live);
        return;
      }

      const data = await loadDatasetAnalytics(id, user.uid);
      if (!data) {
        console.warn(
          `[analytics] No rows for cafe ${id}. AI API: ${AI_API_BASE_URL} — check training CSV on server and seller inventory.`,
        );
      }
      setBundle(data);
    } catch (e) {
      console.error("Analytics load error:", e);
      setBundle(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your shop insights…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bundle && !cafeId) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.emptyCard}>
            <Brain size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptyBody}>
              Upload your past sales file on the dashboard, or add listings and
              complete a few orders — then come back here to see charts.
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push("/(seller)/(tabs)/dashboard")}
            >
              <Sparkles size={18} color={colors.white} />
              <Text style={styles.ctaBtnText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
          <PipelineDiagram />
          <ChartInsight text="Upload your past sales CSV on the dashboard. We analyse patterns in what sold, when, and what was left over — then turn that into charts and bake suggestions you see here." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.emptyCard}>
            <BarChart3 size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptyBody}>
              Your sales file is linked but we could not load chart data. Pull
              down to refresh, or upload your sales file again from the dashboard.
            </Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={onRefresh}>
              <RefreshCw size={18} color={colors.white} />
              <Text style={styles.ctaBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const sourceLabel =
    bundle.dataSource === "dataset"
      ? "From your uploaded sales file"
      : "From live shop activity";

  const activeTabMeta = ANALYTICS_TABS.find((t) => t.key === activeTab);
  const selectedTopItemData = bundle.topSellingItems.find(
    (i) => i.itemName === selectedTopItem,
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerCurve}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shop insights</Text>
          <Text style={styles.headerSub}>
            {bundle.cafeName || cafeName}
          </Text>
          <View style={styles.sourcePill}>
            <Database size={12} color={colors.white} />
            <Text style={styles.sourcePillText}>{sourceLabel}</Text>
          </View>
          <Text style={styles.headerMeta}>
            {bundle.dateRange.start} to {bundle.dateRange.end}
            {bundle.modelAccuracy > 0
              ? ` · suggestions about ${(bundle.modelAccuracy * 100).toFixed(0)}% reliable`
              : ""}
          </Text>
        </View>

        <View style={styles.body}>
          <AnalyticsTabBar activeTab={activeTab} onChange={setActiveTab} />
          {activeTabMeta ? (
            <Text style={styles.tabHint}>{activeTabMeta.hint}</Text>
          ) : null}

          {(activeTab === "overview" || activeTab === "sales") && (
            <>
              <Text style={styles.sectionLabel}>At a glance</Text>
              <Text style={styles.sectionSub}>Tap a number to see what it means</Text>
              <View style={styles.kpiGrid}>
                <KpiCard
                  label="Money earned"
                  value={`RM ${bundle.kpis.totalSales}`}
                  selected={selectedKpi === "revenue"}
                  onPress={() =>
                    setSelectedKpi((k) => (k === "revenue" ? null : "revenue"))
                  }
                />
                <KpiCard
                  label="Items sold"
                  value={String(bundle.kpis.itemsSold)}
                  selected={selectedKpi === "sold"}
                  onPress={() =>
                    setSelectedKpi((k) => (k === "sold" ? null : "sold"))
                  }
                />
                <KpiCard
                  label="Left unsold"
                  value={`${bundle.kpis.wastePercentage}%`}
                  accent={colors.error}
                  selected={selectedKpi === "waste"}
                  onPress={() => {
                    setSelectedKpi((k) => (k === "waste" ? null : "waste"));
                    setActiveTab("waste");
                  }}
                />
                <KpiCard
                  label="Sold vs made"
                  value={`${bundle.kpis.conversionRate}%`}
                  accent={colors.success}
                  selected={selectedKpi === "conversion"}
                  onPress={() =>
                    setSelectedKpi((k) =>
                      k === "conversion" ? null : "conversion",
                    )
                  }
                />
                <KpiCard
                  label="Avg sale price"
                  value={`RM ${bundle.kpis.averageOrderValue}`}
                  selected={selectedKpi === "avg"}
                  onPress={() =>
                    setSelectedKpi((k) => (k === "avg" ? null : "avg"))
                  }
                />
                <KpiCard
                  label="Best seller"
                  value={bundle.kpis.topProduct}
                  small
                  selected={selectedKpi === "top"}
                  onPress={() =>
                    setSelectedKpi((k) => (k === "top" ? null : "top"))
                  }
                />
              </View>
              {selectedKpi && KPI_HELP[selectedKpi] ? (
                <View style={styles.helpCard}>
                  <Text style={styles.helpCardText}>{KPI_HELP[selectedKpi]}</Text>
                </View>
              ) : null}
            </>
          )}

          {activeTab === "overview" && (
            <>
              <Section title="Tips for your shop" subtitle="Plain-language takeaways">
                {bundle.insights.map((line, i) => (
                  <View key={i} style={styles.insightRow}>
                    <TrendingUp size={16} color={colors.primary} />
                    <Text style={styles.insightText}>{line}</Text>
                  </View>
                ))}
              </Section>

              <Section title="How this works" subtitle="From sales file to insights">
                <PipelineDiagram />
                <ChartInsight text="Upload your past sales CSV on the dashboard. We analyse patterns in what sold, when, and what was left over — then turn that into charts and bake suggestions you see here." />
              </Section>
            </>
          )}

          {activeTab === "sales" && (
            <>
              <Section
                title="Daily earnings"
                subtitle="How much money you made each day"
              >
                {bundle.salesOverTime.length > 0 ? (
                  <ChartScroll width={lineChartWidth(bundle.salesOverTime.length)}>
                    <LineChart
                      data={bundle.salesOverTime.map((d) =>
                        lineDataWithDateLabel(d.date, d.sales),
                      )}
                      data2={bundle.salesOverTime.map((d) => ({
                        value: d.orders * 10,
                      }))}
                      height={LINE_CHART_HEIGHT}
                      width={lineChartWidth(bundle.salesOverTime.length)}
                      spacing={LINE_POINT_SPACING}
                      initialSpacing={LINE_INITIAL_SPACING}
                      endSpacing={LINE_CHART_END_MARGIN}
                      yAxisLabelWidth={40}
                      xAxisLabelsHeight={LINE_X_AXIS_LABEL_HEIGHT}
                      xAxisTextNumberOfLines={3}
                      color={colors.primary}
                      color1={colors.primary}
                      color2={colors.success}
                      dataPointsColor={colors.primary}
                      dataPointsColor1={colors.primary}
                      dataPointsColor2={colors.success}
                      dataPointsRadius={4}
                      dataPointsRadius2={4}
                      thickness={2}
                      thickness2={2}
                      yAxisColor={colors.border}
                      xAxisColor={colors.border}
                      noOfSections={4}
                      curved
                      areaChart
                      startFillColor={colors.primary}
                      startOpacity={0.2}
                      endOpacity={0}
                      pointerConfig={{
                        pointerStripHeight: 180,
                        pointerColor: colors.primary,
                        radius: 6,
                        pointerLabelWidth: 140,
                        pointerLabelHeight: 48,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: true,
                        pointerLabelComponent: (
                          items: { value: number }[],
                          _secondary: unknown,
                          pointerIndex: number,
                        ) => {
                          const point = bundle.salesOverTime[pointerIndex];
                          if (!point) return null;
                          return (
                            <View style={styles.pointerLabelMulti}>
                              <Text style={styles.pointerLabelDate}>
                                {getChartDateParts(point.date).full}
                              </Text>
                              <Text style={styles.pointerLabelText}>
                                RM {items[0]?.value ?? point.sales}
                              </Text>
                            </View>
                          );
                        },
                      }}
                    />
                  </ChartScroll>
                ) : (
                  <EmptyChart message="Add dates to your sales file to see daily trends" />
                )}
                <LegendRow
                  items={["Money earned (RM)", "Orders (scaled)"]}
                  colors={[colors.primary, colors.success]}
                />
                <ChartInsight text={getSalesTrendInsight(bundle.salesOverTime)} />
              </Section>

              <Section
                title="Best sellers"
                subtitle="Tap a bar to see full details"
              >
                <BarChart
                  data={bundle.topSellingItems.slice(0, 6).map((item, i) => ({
                    value: item.sold,
                    label: `#${i + 1}`,
                    frontColor:
                      selectedTopItem === item.itemName
                        ? colors.success
                        : colors.primary,
                    onPress: () =>
                      setSelectedTopItem((prev) =>
                        prev === item.itemName ? null : item.itemName,
                      ),
                  }))}
                  height={200}
                  width={CHART_W}
                  barWidth={28}
                  spacing={14}
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  showValuesOnTopOfBars
                  focusBarOnPress
                  xAxisLabelTextStyle={styles.axisLabel}
                />
                <ItemLegend
                  items={bundle.topSellingItems.slice(0, 6).map((item, i) => ({
                    label: item.itemName,
                    color:
                      selectedTopItem === item.itemName
                        ? colors.success
                        : colors.primary,
                    prefix: `#${i + 1}`,
                  }))}
                />
                {selectedTopItemData ? (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{selectedTopItemData.itemName}</Text>
                    <Text style={styles.detailText}>
                      Sold {selectedTopItemData.sold} · Made{" "}
                      {selectedTopItemData.produced} · Earned RM{" "}
                      {selectedTopItemData.revenue.toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tapHint}>Tap a bar or legend row for full details</Text>
                )}
                <ChartInsight text={getTopSellerInsight(bundle.topSellingItems)} />
              </Section>

              <Section title="Money by product" subtitle="Which items bring in the most">
                <BarChart
                  data={bundle.revenueByCategory.map((c, i) => ({
                    value: c.value,
                    label: `#${i + 1}`,
                    frontColor: c.color,
                  }))}
                  height={200}
                  width={CHART_W}
                  barWidth={32}
                  spacing={16}
                  showValuesOnTopOfBars
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  xAxisLabelTextStyle={styles.axisLabel}
                />
                <ItemLegend
                  items={bundle.revenueByCategory.map((c, i) => ({
                    label: c.label,
                    color: c.color,
                    prefix: `#${i + 1}`,
                    suffix: `RM ${c.value.toFixed(0)}`,
                  }))}
                />
                <ChartInsight text={getRevenueInsight(bundle.revenueByCategory)} />
              </Section>

              <Section
                title="Busiest times"
                subtitle="Tap a cell — darker means more orders"
              >
                <HeatmapGrid
                  cells={bundle.heatmap}
                  selectedKey={selectedHeatKey}
                  onSelect={setSelectedHeatKey}
                />
                {selectedHeatKey ? (
                  <Text style={styles.heatSelectionHint}>
                    {selectedHeatKey.replace("|", " · ")} — tap again to clear
                  </Text>
                ) : null}
                <ChartInsight text={getHeatmapInsight(bundle.heatmap)} />
              </Section>
            </>
          )}

          {activeTab === "waste" && (
            <>
              <Section
                title="Sold vs leftover"
                subtitle="Green = sold · Red = left over"
              >
                <WasteStackedChart items={bundle.wasteAnalysis.slice(0, 5)} />
                <LegendRow
                  items={["Sold", "Left over"]}
                  colors={[colors.success, colors.error]}
                />
                <ChartInsight text={getWasteStackInsight(bundle.wasteAnalysis)} />
              </Section>

              <Section title="Where waste happens most" subtitle="Share of total leftovers">
                <View style={styles.pieWrap}>
                  <PieChart
                    data={bundle.wasteAnalysis.slice(0, 5).map((item, i) => ({
                      value: item.waste || 1,
                      color: [
                        colors.primary,
                        colors.error,
                        colors.success,
                        "#C4A77D",
                        "#8B6914",
                      ][i],
                    }))}
                    radius={80}
                    innerRadius={48}
                    donut
                    focusOnPress
                  />
                </View>
                <ItemLegend
                  items={bundle.wasteAnalysis.slice(0, 5).map((item, i) => ({
                    label: item.itemName,
                    color: [
                      colors.primary,
                      colors.error,
                      colors.success,
                      "#C4A77D",
                      "#8B6914",
                    ][i],
                    suffix: `${item.waste} left`,
                  }))}
                />
                <ChartInsight text={getWastePieInsight(bundle.wasteAnalysis)} />
              </Section>

              <Section
                title="Leftover trend"
                subtitle={
                  bundle.surplusTrend.length > 0
                    ? `Last ${bundle.surplusTrend.length} day(s) — lower is better`
                    : "Unsold items over time — lower is better"
                }
              >
                {bundle.surplusTrend.length > 0 ? (
                  <>
                    <Text style={styles.chartTouchHint}>
                      Scroll sideways · press and hold a dot to read the date
                    </Text>
                    <ChartScroll width={lineChartWidth(bundle.surplusTrend.length)}>
                      <LineChart
                        data={bundle.surplusTrend.map((d) =>
                          lineDataWithDateLabel(d.date, d.surplus),
                        )}
                        height={LINE_CHART_HEIGHT}
                        width={lineChartWidth(bundle.surplusTrend.length)}
                        spacing={LINE_POINT_SPACING}
                        initialSpacing={LINE_INITIAL_SPACING}
                        endSpacing={LINE_CHART_END_MARGIN}
                        yAxisLabelWidth={40}
                        xAxisLabelsHeight={LINE_X_AXIS_LABEL_HEIGHT}
                        xAxisTextNumberOfLines={3}
                        color={colors.error}
                        dataPointsColor={colors.error}
                        dataPointsRadius={5}
                        thickness={2}
                        areaChart
                        startFillColor={colors.error}
                        startOpacity={0.25}
                        endOpacity={0}
                        yAxisColor={colors.border}
                        xAxisColor={colors.border}
                        curved
                        pointerConfig={{
                          pointerStripHeight: 180,
                          pointerColor: colors.error,
                          radius: 6,
                          pointerLabelWidth: 140,
                          pointerLabelHeight: 52,
                          activatePointersOnLongPress: true,
                          autoAdjustPointerLabelPosition: true,
                          pointerLabelComponent: (
                            items: { value: number }[],
                            _secondary: unknown,
                            pointerIndex: number,
                          ) => {
                            const point = bundle.surplusTrend[pointerIndex];
                            if (!point) return null;
                            return (
                              <View style={styles.pointerLabelMulti}>
                                <Text style={styles.pointerLabelDate}>
                                  {getChartDateParts(point.date).full}
                                </Text>
                                <Text style={styles.pointerLabelText}>
                                  Left over: {items[0]?.value ?? point.surplus}
                                </Text>
                                <Text
                                  style={[
                                    styles.pointerLabelText,
                                    { color: colors.successSoft },
                                  ]}
                                >
                                  Sold: {point.sold}
                                </Text>
                              </View>
                            );
                          },
                        }}
                      />
                    </ChartScroll>
                    <DateBreakdownTable
                      rows={bundle.surplusTrend.map((d) => ({
                        dateKey: d.date,
                        primary: `${d.surplus} left over`,
                        secondary: `${d.sold} sold`,
                      }))}
                    />
                  </>
                ) : (
                  <EmptyChart message="Add dated sales rows to see leftover trends" />
                )}
                <ChartInsight text={getSurplusTrendInsight(bundle.surplusTrend)} />
              </Section>

              <Section
                title="Did you bake too much?"
                subtitle="Each dot is one product — closer to the line means less waste"
              >
                <ScatterPlot points={bundle.scatterData} />
                <ChartInsight text={getScatterInsight(bundle.scatterData)} />
              </Section>
            </>
          )}

          {activeTab === "planning" && (
            <>
              {bundle.itemForecasts && bundle.itemForecasts.length > 0 ? (
                <Section
                  title="How much to bake today"
                  subtitle="Suggested amounts from your sales history"
                >
                  <BarChart
                    data={bundle.itemForecasts.map((f, i) => ({
                      value: f.predicted,
                      label: `#${i + 1}`,
                      frontColor: colors.success,
                    }))}
                    height={200}
                    width={CHART_W}
                    barWidth={24}
                    spacing={12}
                    showValuesOnTopOfBars
                    yAxisColor={colors.border}
                    xAxisColor={colors.border}
                    xAxisLabelTextStyle={styles.axisLabel}
                  />
                  <ItemLegend
                    items={bundle.itemForecasts.map((f, i) => ({
                      label: f.item,
                      color: colors.success,
                      prefix: `#${i + 1}`,
                      suffix: `${f.predicted} units`,
                    }))}
                  />
                  <ChartInsight text={getForecastInsight(bundle.itemForecasts)} />
                  <Text style={styles.tapHint}>
                    Use the Bake planner on your dashboard for full suggestions
                  </Text>
                </Section>
              ) : (
                <Section title="How much to bake today" subtitle="Upload a sales file first">
                  <EmptyChart message="Upload your sales file on the dashboard to get bake suggestions here" />
                </Section>
              )}

              <Section
                title="What happened vs what we expected"
                subtitle={
                  bundle.actualVsPredicted.length > 0
                    ? `Last ${bundle.actualVsPredicted.length} day(s) with sales data — scroll for all dates`
                    : "Compare actual sales with suggested amounts"
                }
              >
                {bundle.actualVsPredicted.length > 0 ? (
                  <>
                    <Text style={styles.chartTouchHint}>
                      Scroll sideways · press and hold a dot to read the date
                    </Text>
                    <ChartScroll
                      width={lineChartWidth(bundle.actualVsPredicted.length)}
                    >
                      <LineChart
                        data={bundle.actualVsPredicted.map((d) =>
                          lineDataWithDateLabel(d.date, d.actual),
                        )}
                        data2={bundle.actualVsPredicted.map((d) => ({
                          value: d.predicted,
                        }))}
                        height={LINE_CHART_HEIGHT}
                        width={lineChartWidth(bundle.actualVsPredicted.length)}
                        spacing={LINE_POINT_SPACING}
                        initialSpacing={LINE_INITIAL_SPACING}
                        endSpacing={LINE_CHART_END_MARGIN}
                        yAxisLabelWidth={40}
                        xAxisLabelsHeight={LINE_X_AXIS_LABEL_HEIGHT}
                        xAxisTextNumberOfLines={3}
                        color={DUAL_LINE_SERIES.primary.color}
                        color1={DUAL_LINE_SERIES.primary.color}
                        color2={DUAL_LINE_SERIES.secondary.color}
                        dataPointsColor={DUAL_LINE_SERIES.primary.color}
                        dataPointsColor1={DUAL_LINE_SERIES.primary.color}
                        dataPointsColor2={DUAL_LINE_SERIES.secondary.color}
                        dataPointsRadius={5}
                        dataPointsRadius2={5}
                        thickness={2}
                        thickness2={2}
                        yAxisColor={colors.border}
                        xAxisColor={colors.border}
                        noOfSections={4}
                        pointerConfig={{
                          pointerStripHeight: 180,
                          pointerColor: DUAL_LINE_SERIES.primary.color,
                          radius: 6,
                          pointerLabelWidth: 150,
                          pointerLabelHeight: 64,
                          activatePointersOnLongPress: true,
                          autoAdjustPointerLabelPosition: true,
                          pointerLabelComponent: (
                            items: { value: number }[],
                            _secondary: unknown,
                            pointerIndex: number,
                          ) => {
                            const point = bundle.actualVsPredicted[pointerIndex];
                            if (!point) return null;
                            return (
                              <View style={styles.pointerLabelMulti}>
                                <Text style={styles.pointerLabelDate}>
                                  {getChartDateParts(point.date).full}
                                </Text>
                                <Text style={styles.pointerLabelText}>
                                  Sold: {items[0]?.value ?? point.actual}
                                </Text>
                                <Text
                                  style={[
                                    styles.pointerLabelText,
                                    { color: DUAL_LINE_SERIES.secondary.color },
                                  ]}
                                >
                                  Expected: {items[1]?.value ?? point.predicted}
                                </Text>
                              </View>
                            );
                          },
                        }}
                      />
                    </ChartScroll>
                    <DateBreakdownTable
                      rows={bundle.actualVsPredicted.map((d) => ({
                        dateKey: d.date,
                        primary: `Sold ${d.actual}`,
                        secondary: `Expected ${d.predicted}`,
                      }))}
                    />
                  </>
                ) : (
                  <EmptyChart message="Add dated sales rows to compare actual vs expected" />
                )}
                <LegendRow
                  items={[
                    DUAL_LINE_SERIES.primary.label,
                    DUAL_LINE_SERIES.secondary.label,
                  ]}
                  colors={[
                    DUAL_LINE_SERIES.primary.color,
                    DUAL_LINE_SERIES.secondary.color,
                  ]}
                />
                <ChartInsight text={getActualVsPredictedInsight(bundle.actualVsPredicted)} />
              </Section>

              <Section
                title="From kitchen to customer"
                subtitle="How much you made, sold, and had left over"
              >
                <FunnelChart stages={bundle.funnel} />
                <ChartInsight text={getFunnelInsight(bundle.funnel)} />
              </Section>
            </>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalyticsTabBar({
  activeTab,
  onChange,
}: {
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBar}
    >
      {ANALYTICS_TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabChip, active && styles.tabChipActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  accent,
  small,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  accent?: string;
  small?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.kpiCard, selected && styles.kpiCardSelected]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[styles.kpiValue, accent ? { color: accent } : null, small && styles.kpiSmall]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      <View style={styles.chartCard}>{children}</View>
    </View>
  );
}

function ChartDateAxisLabel({ dateKey }: { dateKey: string }) {
  const parts = getChartDateParts(dateKey);
  return (
    <View style={styles.chartDateLabel}>
      <Text style={styles.chartDateWeekday}>{parts.weekday}</Text>
      <Text style={styles.chartDateDay}>{parts.day}</Text>
      <Text style={styles.chartDateMonth}>{parts.month}</Text>
    </View>
  );
}

function DateBreakdownTable({
  rows,
}: {
  rows: { dateKey: string; primary: string; secondary: string }[];
}) {
  return (
    <View style={styles.dateTable}>
      <Text style={styles.dateTableTitle}>Dates in this chart</Text>
      {rows.map((row) => {
        const parts = getChartDateParts(row.dateKey);
        return (
          <View key={row.dateKey} style={styles.dateTableRow}>
            <View style={styles.dateTableDateCol}>
              <Text style={styles.dateTableWeekday}>{parts.weekday}</Text>
              <Text style={styles.dateTableDateNum}>
                {parts.day} {parts.month}
              </Text>
            </View>
            <View style={styles.dateTableValuesCol}>
              <Text style={styles.dateTablePrimary}>{row.primary}</Text>
              <Text style={styles.dateTableSecondary}>{row.secondary}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ChartInsight({ text }: { text: string }) {
  return (
    <View style={styles.chartInsight}>
      <Info size={15} color={colors.primary} style={styles.chartInsightIcon} />
      <Text style={styles.chartInsightText}>{text}</Text>
    </View>
  );
}

function ItemLegend({
  items,
}: {
  items: {
    label: string;
    color: string;
    prefix?: string;
    suffix?: string;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.itemLegend}>
      {items.map((item) => (
        <View key={`${item.prefix ?? ""}-${item.label}`} style={styles.itemLegendRow}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          {item.prefix ? (
            <Text style={styles.itemLegendPrefix}>{item.prefix}</Text>
          ) : null}
          <Text style={styles.itemLegendLabel}>{item.label}</Text>
          {item.suffix ? (
            <Text style={styles.itemLegendSuffix}>{item.suffix}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function WasteStackedChart({
  items,
}: {
  items: { itemName: string; sold: number; waste: number }[];
}) {
  if (items.length === 0) {
    return <EmptyChart message="No waste data yet" />;
  }

  return (
    <View style={styles.wasteStackWrap}>
      {items.map((item) => {
        const total = item.sold + item.waste || 1;
        const soldPct = (item.sold / total) * 100;
        const wastePct = (item.waste / total) * 100;
        return (
          <View key={item.itemName} style={styles.wasteStackRow}>
            <Text style={styles.wasteStackLabel}>{item.itemName}</Text>
            <View style={styles.wasteStackBar}>
              <View
                style={[
                  styles.wasteStackSegment,
                  { width: `${soldPct}%`, backgroundColor: colors.success },
                ]}
              />
              <View
                style={[
                  styles.wasteStackSegment,
                  { width: `${wastePct}%`, backgroundColor: colors.error },
                ]}
              />
            </View>
            <Text style={styles.wasteStackMeta}>
              {item.sold} sold · {item.waste} left over
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ChartScroll({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chartScrollContent}
    >
      <View
        style={[
          styles.chartScrollInner,
          {
            width:
              width + LINE_CHART_START_MARGIN + LINE_CHART_END_MARGIN,
            paddingLeft: LINE_CHART_START_MARGIN,
            paddingRight: LINE_CHART_END_MARGIN,
          },
        ]}
      >
        {children}
      </View>
    </ScrollView>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{message}</Text>
    </View>
  );
}

function LegendRow({
  items,
  colors: legendColors,
}: {
  items: string[];
  colors?: string[];
}) {
  return (
    <View style={styles.legendRow}>
      {items.map((item, i) => (
        <View key={item} style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: legendColors?.[i] ?? colors.primary },
            ]}
          />
          <Text style={styles.legendText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function HeatmapGrid({
  cells,
  selectedKey,
  onSelect,
}: {
  cells: { day: string; time: string; orders: number }[];
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const times = ["Morning", "Afternoon", "Evening", "Night"];
  const max = Math.max(1, ...cells.map((c) => c.orders));

  return (
    <View>
      <View style={styles.heatRow}>
        <View style={styles.heatCorner} />
        {times.map((t) => (
          <Text key={t} style={styles.heatColLabel} numberOfLines={2}>
            {shortAxisLabel(t, 9)}
          </Text>
        ))}
      </View>
      {days.map((day) => (
        <View key={day} style={styles.heatRow}>
          <Text style={styles.heatRowLabel}>{day}</Text>
          {times.map((time) => {
            const cell = cells.find(
              (c) => c.day.startsWith(day.slice(0, 3)) && c.time === time,
            );
            const intensity = (cell?.orders ?? 0) / max;
            const key = `${day}|${time}`;
            const selected = selectedKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: `rgba(106, 60, 0, ${0.12 + intensity * 0.75})`,
                  },
                  selected && styles.heatCellSelected,
                ]}
                onPress={() =>
                  onSelect?.(selected ? null : key)
                }
                activeOpacity={0.85}
              >
                <Text style={styles.heatCellText}>{cell?.orders ?? 0}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function FunnelChart({
  stages,
}: {
  stages: { stage: string; count: number; color: string }[];
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <View style={styles.funnelWrap}>
      {stages.map((s) => (
        <View key={s.stage} style={styles.funnelRow}>
          <View style={styles.funnelHeader}>
            <Text style={styles.funnelLabel}>{s.stage}</Text>
            <Text style={styles.funnelCount}>{s.count.toLocaleString()}</Text>
          </View>
          <View style={styles.funnelBarTrack}>
            <View
              style={[
                styles.funnelBar,
                {
                  width: `${Math.max((s.count / max) * 100, 4)}%`,
                  backgroundColor: s.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ScatterPlot({
  points,
}: {
  points: { item: string; prepared: number; sold: number }[];
}) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const W = CHART_W;
  const H = 200;
  const pad = 28;
  const maxX = Math.max(...points.map((p) => p.prepared), 1);
  const maxY = Math.max(...points.map((p) => p.sold), 1);
  const selectedPoint = points.find((p) => p.item === selectedItem);
  const sellThrough = (p: { prepared: number; sold: number }) =>
    p.prepared > 0 ? Math.round((p.sold / p.prepared) * 100) : 0;

  if (points.length === 0) {
    return <EmptyChart message="No bake-vs-sell data yet" />;
  }

  return (
    <View>
      <Svg width={W} height={H}>
        <SvgLine
          x1={pad}
          y1={H - pad}
          x2={W - pad}
          y2={pad}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {points.map((p, i) => {
          const cx = pad + (p.prepared / maxX) * (W - pad * 2);
          const cy = H - pad - (p.sold / maxY) * (H - pad * 2);
          const dotColor = SCATTER_COLORS[i % SCATTER_COLORS.length];
          const selected = selectedItem === p.item;
          return (
            <G key={`${p.item}-${i}`}>
              <Circle
                cx={cx}
                cy={cy}
                r={16}
                fill="transparent"
                onPress={() =>
                  setSelectedItem((prev) => (prev === p.item ? null : p.item))
                }
              />
              {selected ? (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={11}
                  fill={dotColor}
                  opacity={0.25}
                />
              ) : null}
              <Circle
                cx={cx}
                cy={cy}
                r={selected ? 8 : 6}
                fill={dotColor}
                stroke={selected ? colors.text : "transparent"}
                strokeWidth={2}
                opacity={selected ? 1 : 0.9}
                onPress={() =>
                  setSelectedItem((prev) => (prev === p.item ? null : p.item))
                }
              />
            </G>
          );
        })}
      </Svg>

      {selectedPoint ? (
        <View style={styles.scatterDetail}>
          <View
            style={[
              styles.scatterDetailDot,
              {
                backgroundColor:
                  SCATTER_COLORS[
                    points.findIndex((p) => p.item === selectedPoint.item) %
                      SCATTER_COLORS.length
                  ],
              },
            ]}
          />
          <View style={styles.scatterDetailText}>
            <Text style={styles.scatterDetailTitle}>{selectedPoint.item}</Text>
            <Text style={styles.scatterDetailMeta}>
              {selectedPoint.sold} sold of {selectedPoint.prepared} made ·{" "}
              {sellThrough(selectedPoint)}% sold
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.tapHint}>Tap a coloured dot to see which product it is</Text>
      )}

      <View style={styles.scatterLegend}>
        {points.map((p, i) => {
          const dotColor = SCATTER_COLORS[i % SCATTER_COLORS.length];
          const selected = selectedItem === p.item;
          return (
            <TouchableOpacity
              key={p.item}
              style={[
                styles.scatterLegendRow,
                selected && styles.scatterLegendRowSelected,
              ]}
              onPress={() =>
                setSelectedItem((prev) => (prev === p.item ? null : p.item))
              }
              activeOpacity={0.85}
            >
              <View style={[styles.scatterLegendDot, { backgroundColor: dotColor }]} />
              <Text
                style={[
                  styles.scatterLegendText,
                  selected && styles.scatterLegendTextSelected,
                ]}
              >
                {p.item}: {p.sold} sold of {p.prepared} made
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.axisHint}>
        Horizontal = how much you made · Vertical = how much sold
      </Text>
    </View>
  );
}

function PipelineDiagram() {
  const steps = [
    { icon: Database, label: "Upload sales file" },
    { icon: BarChart3, label: "We read it" },
    { icon: Brain, label: "Learn patterns" },
    { icon: Sparkles, label: "Bake suggestions" },
    { icon: TrendingUp, label: "See insights" },
  ];
  return (
    <View style={styles.pipeline}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <View style={styles.pipeNode}>
            <step.icon size={20} color={colors.primary} />
            <Text style={styles.pipeLabel}>{step.label}</Text>
          </View>
          {i < steps.length - 1 ? (
            <ChevronRight
              size={18}
              color={colors.textSoft}
              style={styles.pipeArrow}
            />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const CARD_W = (SCREEN_W - spacing.lg * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  loadingText: { color: colors.textSoft, fontSize: 14 },
  headerCurve: {
    backgroundColor: colors.primary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: { marginBottom: spacing.md },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.white,
  },
  headerSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  headerMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
    lineHeight: 17,
    flexWrap: "wrap",
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  sourcePillText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: "600",
  },
  emptyChart: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyChartText: {
    fontSize: 13,
    color: colors.textSoft,
    textAlign: "center",
  },
  wasteStackWrap: { gap: spacing.md, paddingVertical: spacing.sm },
  wasteStackRow: {
    gap: 6,
    marginBottom: spacing.xs,
  },
  wasteStackLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 18,
  },
  wasteStackBar: {
    height: 22,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  wasteStackSegment: { height: "100%" },
  wasteStackMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
  },
  chartInsight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.1)",
  },
  chartInsightIcon: { marginTop: 2 },
  chartInsightText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  itemLegend: {
    marginTop: spacing.sm,
    gap: 8,
  },
  itemLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  itemLegendPrefix: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSoft,
    minWidth: 22,
  },
  itemLegendLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 18,
  },
  itemLegendSuffix: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
  },
  pieWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  axisLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
  },
  body: { padding: spacing.lg, marginTop: -spacing.md },
  tabBar: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSoft,
  },
  tabChipTextActive: {
    color: colors.white,
  },
  tabHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.md,
  },
  helpCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  helpCardText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  detailCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  tapHint: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: spacing.sm,
    textAlign: "center",
    fontStyle: "italic",
  },
  chartScrollContent: {
    flexGrow: 1,
  },
  chartScrollInner: {
    overflow: "visible",
  },
  chartTouchHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  chartDateLabel: {
    width: 52,
    alignItems: "center",
    paddingTop: 4,
  },
  chartDateWeekday: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSoft,
    lineHeight: 14,
  },
  chartDateDay: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 18,
  },
  chartDateMonth: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSoft,
    lineHeight: 14,
  },
  dateTable: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  dateTableTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  dateTableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  dateTableDateCol: {
    width: 72,
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
  },
  dateTableWeekday: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSoft,
  },
  dateTableDateNum: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  dateTableValuesCol: {
    flex: 1,
    gap: 2,
  },
  dateTablePrimary: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  dateTableSecondary: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  pointerLabel: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pointerLabelMulti: {
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 120,
  },
  pointerLabelDate: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  pointerLabelText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  heatCellSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  heatSelectionHint: {
    fontSize: 11,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: "center",
    fontWeight: "600",
  },
  section: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  kpiCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  kpiLabel: { fontSize: 11, color: colors.textSoft, fontWeight: "600" },
  kpiValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 6,
    lineHeight: 26,
  },
  kpiSmall: { fontSize: 13, lineHeight: 18 },
  legendRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
    flexShrink: 1,
  },
  insightRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
  },
  insightText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  heatRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  heatCorner: { width: 40 },
  heatColLabel: {
    flex: 1,
    fontSize: 10,
    textAlign: "center",
    color: colors.textSoft,
    fontWeight: "600",
    lineHeight: 13,
    paddingHorizontal: 1,
  },
  heatRowLabel: {
    width: 40,
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  heatCell: {
    flex: 1,
    margin: 2,
    borderRadius: 6,
    paddingVertical: 10,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heatCellText: { fontSize: 11, fontWeight: "700", color: colors.text },
  funnelWrap: { gap: spacing.md },
  funnelRow: { gap: 6 },
  funnelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  funnelLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 18,
  },
  funnelBarTrack: {
    height: 22,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    overflow: "hidden",
  },
  funnelBar: { height: "100%", borderRadius: 8 },
  funnelCount: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "700",
  },
  scatterDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.12)",
  },
  scatterDetailDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  scatterDetailText: { flex: 1 },
  scatterDetailTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  scatterDetailMeta: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
  },
  scatterLegend: { marginTop: spacing.sm, gap: 6 },
  scatterLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  scatterLegendRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  scatterLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scatterLegendText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
  },
  scatterLegendTextSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  axisHint: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: spacing.sm,
    textAlign: "center",
    lineHeight: 16,
  },
  pipeline: {
    gap: 4,
    paddingVertical: spacing.sm,
    alignItems: "stretch",
  },
  pipeNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  pipeLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 18,
  },
  pipeArrow: {
    alignSelf: "center",
    transform: [{ rotate: "90deg" }],
    marginVertical: 2,
  },
  emptyWrap: { padding: spacing.lg, flexGrow: 1 },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  ctaBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
