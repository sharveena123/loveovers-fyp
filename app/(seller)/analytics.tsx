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
import Svg, { Circle, Line as SvgLine } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - spacing.lg * 2 - spacing.lg * 2;

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
                  <ChartScroll
                    width={Math.max(CHART_W, bundle.salesOverTime.length * 48)}
                  >
                    <LineChart
                      data={bundle.salesOverTime.map((d) => ({
                        value: d.sales,
                        label: d.label,
                      }))}
                      data2={bundle.salesOverTime.map((d) => ({
                        value: d.orders * 10,
                      }))}
                      height={200}
                      width={Math.max(CHART_W, bundle.salesOverTime.length * 48)}
                      color={colors.primary}
                      color2={colors.success}
                      thickness={2}
                      yAxisColor={colors.border}
                      xAxisColor={colors.border}
                      noOfSections={4}
                      curved
                      areaChart
                      startFillColor={colors.primary}
                      startOpacity={0.2}
                      endOpacity={0}
                      pointerConfig={{
                        pointerStripHeight: 160,
                        pointerColor: colors.primary,
                        radius: 6,
                        pointerLabelWidth: 120,
                        pointerLabelHeight: 36,
                        activatePointersOnLongPress: false,
                        autoAdjustPointerLabelPosition: true,
                        pointerLabelComponent: (
                          items: { value: number }[],
                        ) => (
                          <View style={styles.pointerLabel}>
                            <Text style={styles.pointerLabelText}>
                              RM {items[0]?.value ?? 0}
                            </Text>
                          </View>
                        ),
                      }}
                    />
                  </ChartScroll>
                ) : (
                  <EmptyChart message="Add dates to your sales file to see daily trends" />
                )}
                <LegendRow items={["Money earned (RM)", "Orders (scaled)"]} />
              </Section>

              <Section
                title="Best sellers"
                subtitle="Tap a bar to see full details"
              >
                <BarChart
                  data={bundle.topSellingItems.slice(0, 6).map((item) => ({
                    value: item.sold,
                    label: item.itemName.slice(0, 6),
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
                  <Text style={styles.tapHint}>Tap a bar above to see the product name</Text>
                )}
              </Section>

              <Section title="Money by product" subtitle="Which items bring in the most">
                <BarChart
                  data={bundle.revenueByCategory.map((c) => ({
                    value: c.value,
                    label: c.label.slice(0, 6),
                    frontColor: c.color,
                  }))}
                  height={200}
                  width={CHART_W}
                  barWidth={32}
                  spacing={16}
                  showValuesOnTopOfBars
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                />
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
              </Section>

              <Section title="Where waste happens most" subtitle="Share of total leftovers">
                <PieChart
                  data={bundle.wasteAnalysis.slice(0, 5).map((item, i) => ({
                    value: item.waste || 1,
                    text: item.itemName.slice(0, 8),
                    color: [
                      colors.primary,
                      colors.error,
                      colors.success,
                      "#C4A77D",
                      "#8B6914",
                    ][i],
                  }))}
                  radius={90}
                  innerRadius={50}
                  donut
                  showText
                  textColor={colors.text}
                  textSize={10}
                  focusOnPress
                />
              </Section>

              <Section
                title="Leftover trend"
                subtitle="Unsold items over time — lower is better"
              >
                <LineChart
                  data={bundle.surplusTrend.map((d) => ({
                    value: d.surplus,
                    label: d.label,
                  }))}
                  height={180}
                  width={CHART_W}
                  color={colors.error}
                  areaChart
                  startFillColor={colors.error}
                  startOpacity={0.25}
                  endOpacity={0}
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  curved
                />
              </Section>

              <Section
                title="Did you bake too much?"
                subtitle="Each dot is one product — closer to the line means less waste"
              >
                <ScatterPlot points={bundle.scatterData} />
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
                    data={bundle.itemForecasts.map((f) => ({
                      value: f.predicted,
                      label: f.item.slice(0, 5),
                      frontColor: colors.success,
                    }))}
                    height={200}
                    width={CHART_W}
                    barWidth={24}
                    spacing={12}
                    showValuesOnTopOfBars
                    yAxisColor={colors.border}
                    xAxisColor={colors.border}
                  />
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
                subtitle="Compare actual sales with suggested amounts"
              >
                <LineChart
                  data={bundle.actualVsPredicted.map((d) => ({
                    value: d.actual,
                    label: d.label,
                  }))}
                  data2={bundle.actualVsPredicted.map((d) => ({
                    value: d.predicted,
                  }))}
                  height={200}
                  width={CHART_W}
                  color={colors.primary}
                  color2={colors.success}
                  thickness={2}
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  noOfSections={4}
                />
                <LegendRow items={["Actually sold", "Expected to sell"]} />
              </Section>

              <Section
                title="From kitchen to customer"
                subtitle="How much you made, sold, and had left over"
              >
                <FunnelChart stages={bundle.funnel} />
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
            <Text style={styles.wasteStackLabel} numberOfLines={1}>
              {item.itemName}
            </Text>
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
              {item.sold} sold · {item.waste} left
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width }}>{children}</View>
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
          <Text key={t} style={styles.heatColLabel}>
            {t === "Morning"
              ? "AM"
              : t === "Afternoon"
                ? "Mid"
                : t === "Evening"
                  ? "Eve"
                  : "Night"}
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
      {stages.map((s, i) => (
        <View key={s.stage} style={styles.funnelRow}>
          <Text style={styles.funnelLabel}>{s.stage}</Text>
          <View style={styles.funnelBarTrack}>
            <View
              style={[
                styles.funnelBar,
                {
                  width: `${(s.count / max) * 100}%`,
                  backgroundColor: s.color,
                },
              ]}
            />
          </View>
          <Text style={styles.funnelCount}>{s.count.toLocaleString()}</Text>
          {i < stages.length - 1 ? (
            <ChevronRight
              size={14}
              color={colors.textSoft}
              style={styles.funnelArrow}
            />
          ) : null}
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
  const W = CHART_W;
  const H = 200;
  const pad = 28;
  const maxX = Math.max(...points.map((p) => p.prepared), 1);
  const maxY = Math.max(...points.map((p) => p.sold), 1);

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
          const cx = pad + ((p.prepared / maxX) * (W - pad * 2));
          const cy = H - pad - (p.sold / maxY) * (H - pad * 2);
          return (
            <Circle
              key={`${p.item}-${i}`}
              cx={cx}
              cy={cy}
              r={6}
              fill={colors.primary}
              opacity={0.85}
            />
          );
        })}
      </Svg>
      <View style={styles.scatterLegend}>
        {points.slice(0, 4).map((p) => (
          <Text key={p.item} style={styles.scatterLegendText} numberOfLines={1}>
            {p.item}: {p.sold}/{p.prepared}
          </Text>
        ))}
      </View>
      <Text style={styles.axisHint}>
        Left = how much you made · Up = how much sold
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
            <step.icon size={18} color={colors.primary} />
            <Text style={styles.pipeLabel}>{step.label}</Text>
          </View>
          {i < steps.length - 1 ? (
            <ChevronRight size={16} color={colors.textSoft} />
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  wasteStackLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  wasteStackBar: {
    flex: 1,
    height: 22,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  wasteStackSegment: { height: "100%" },
  wasteStackMeta: {
    width: 44,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSoft,
    textAlign: "right",
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
  pointerLabel: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    overflow: "hidden",
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
  },
  kpiSmall: { fontSize: 14 },
  legendRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textSoft },
  insightRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
  },
  insightText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  heatRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  heatCorner: { width: 36 },
  heatColLabel: {
    flex: 1,
    fontSize: 10,
    textAlign: "center",
    color: colors.textSoft,
    fontWeight: "600",
  },
  heatRowLabel: {
    width: 36,
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  heatCell: {
    flex: 1,
    margin: 2,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  heatCellText: { fontSize: 10, fontWeight: "700", color: colors.text },
  funnelWrap: { gap: spacing.sm },
  funnelRow: { marginBottom: spacing.xs },
  funnelLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 4 },
  funnelBarTrack: {
    height: 22,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    overflow: "hidden",
  },
  funnelBar: { height: "100%", borderRadius: 8 },
  funnelCount: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 2,
    fontWeight: "600",
  },
  funnelArrow: { alignSelf: "center", marginVertical: 2 },
  scatterLegend: { marginTop: spacing.sm, gap: 2 },
  scatterLegendText: { fontSize: 11, color: colors.textSoft },
  axisHint: { fontSize: 10, color: colors.textSoft, marginTop: 4, textAlign: "center" },
  pipeline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
  },
  pipeNode: {
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    minWidth: 72,
  },
  pipeLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
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
