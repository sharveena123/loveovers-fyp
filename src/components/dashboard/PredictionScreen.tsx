import { Text, TextInput } from "@/src/components/StyledText";
import { colors, spacing } from "@/src/theme/styles";
import {
  BarChart3,
  Cloud,
  CloudRain,
  RefreshCw,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { batchPredict, getCafeInfo, predictForCafe } from "../../ai/api";
import { PredictionResponse } from "../../ai/types";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WEATHERS = [
  { label: "Sunny", value: "Sunny", icon: Sun },
  { label: "Cloudy", value: "Cloudy", icon: Cloud },
  { label: "Rainy", value: "Rainy", icon: CloudRain },
];

interface PredictionScreenProps {
  cafeId: string;
  onModelNotFound?: () => void;
  onRetrain?: () => void;
}

export function PredictionScreen({
  cafeId,
  onModelNotFound,
  onRetrain,
}: PredictionScreenProps) {
  const [cafeName, setCafeName] = useState("");
  const [cafeItems, setCafeItems] = useState<string[]>([]);

  const [selectedItem, setSelectedItem] = useState("");
  const [selectedDay, setSelectedDay] = useState("Saturday");
  const [selectedWeather, setSelectedWeather] = useState("Sunny");
  const [price, setPrice] = useState("");

  const [useDiscount, setUseDiscount] = useState(false);
  const [discount, setDiscount] = useState("10");

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [batchResult, setBatchResult] = useState<{
    day: string;
    discount_pct: number;
    predictions: {
      item: string;
      predicted_sales: number;
      base_predicted_sales: number;
      recommended_production: number;
      expected_surplus: number;
    }[];
    total_recommended_production: number;
    total_expected_surplus: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCafe, setLoadingCafe] = useState(true);

  useEffect(() => {
    setLoadingCafe(true);
    setResult(null);
    setBatchResult(null);
    loadCafeInfo();
  }, [cafeId]);

  const loadCafeInfo = async () => {
    if (!cafeId) {
      setLoadingCafe(false);
      return;
    }
    try {
      const info = (await getCafeInfo(cafeId)) as {
        cafe_name: string;
        items: string[];
      };
      setCafeName(info.cafe_name);
      setCafeItems(info.items);
      if (info.items.length > 0) setSelectedItem(info.items[0]);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      if (err?.message?.includes("404") || err?.status === 404) {
        Alert.alert(
          "Model not found",
          "The trained model was not found. Please re-train your model.",
          [{ text: "OK" }],
        );
        onModelNotFound?.();
      } else {
        Alert.alert("Error", `Failed to load cafe info: ${String(error)}`);
      }
    } finally {
      setLoadingCafe(false);
    }
  };

  const handlePredict = async () => {
    if (!cafeId) {
      Alert.alert("No cafe", "Please upload and train your data first.");
      return;
    }

    try {
      setLoading(true);
      setBatchResult(null);
      const discountPct = useDiscount ? Number(discount) : 0;
      const response = await predictForCafe({
        cafe_id: cafeId,
        item: selectedItem,
        day_of_week: selectedDay as "Monday",
        weather: selectedWeather as "Sunny",
        price: Number(price) || 0,
        discount_pct: discountPct,
      });
      setResult(response);
    } catch (error) {
      Alert.alert("Prediction failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPredict = async () => {
    if (!cafeId) {
      Alert.alert("No cafe", "Please upload and train your data first.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      const discountPct = useDiscount ? Number(discount) : 0;
      const response = await batchPredict(
        cafeId,
        selectedDay as "Monday",
        selectedWeather as "Sunny",
        discountPct,
      );
      setBatchResult(response);
    } catch (error) {
      Alert.alert("Batch failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  if (loadingCafe) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading model data…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Sparkles size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cafeName} numberOfLines={1}>
              {cafeName}
            </Text>
            <Text style={styles.headerSubtitle}>Surplus prediction</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.retrainBtn}
          onPress={() => onRetrain?.()}
          activeOpacity={0.85}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={styles.retrainText}>Retrain</Text>
        </TouchableOpacity>
      </View>

      {/* Item selector */}
      <Text style={styles.fieldLabel}>Item</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {cafeItems.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, selectedItem === item && styles.chipActive]}
            onPress={() => setSelectedItem(item)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.chipText,
                selectedItem === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day */}
      <Text style={styles.fieldLabel}>Day</Text>
      <View style={styles.chipWrap}>
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayChip, selectedDay === day && styles.chipActive]}
            onPress={() => setSelectedDay(day)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.dayChipText,
                selectedDay === day && styles.chipTextActive,
              ]}
            >
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Weather */}
      <Text style={styles.fieldLabel}>Weather</Text>
      <View style={styles.weatherRow}>
        {WEATHERS.map((w) => {
          const Icon = w.icon;
          const active = selectedWeather === w.value;
          return (
            <TouchableOpacity
              key={w.value}
              style={[styles.weatherChip, active && styles.weatherChipActive]}
              onPress={() => setSelectedWeather(w.value)}
              activeOpacity={0.85}
            >
              <Icon size={18} color={active ? colors.white : colors.textSoft} />
              <Text
                style={[
                  styles.weatherText,
                  active && styles.weatherTextActive,
                ]}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Price */}
      <Text style={styles.fieldLabel}>Price (RM)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="6.50"
        placeholderTextColor={colors.textSoft}
      />

      {/* Discount */}
      <View style={styles.discountCard}>
        <View style={styles.discountHeader}>
          <View>
            <Text style={styles.discountTitle}>Mystery bag discount</Text>
            <Text style={styles.discountDesc}>
              Simulate a &quot;what if&quot; discount scenario
            </Text>
          </View>
          <Switch
            value={useDiscount}
            onValueChange={setUseDiscount}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {useDiscount && (
          <View style={styles.discountBody}>
            <TextInput
              style={styles.input}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={colors.textSoft}
            />
            <Text style={styles.discountHint}>
              {discount}% off → ~{Math.round(Number(discount) * 1.5)}% more sales
              expected
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.predictBtn, loading && styles.btnDisabled]}
          onPress={handlePredict}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading && !batchResult ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.predictBtnText}>Predict item</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.batchBtn, loading && styles.btnDisabled]}
          onPress={handleBatchPredict}
          disabled={loading}
          activeOpacity={0.88}
        >
          <BarChart3 size={18} color={colors.primary} />
          <Text style={styles.batchBtnText}>Full day</Text>
        </TouchableOpacity>
      </View>

      {/* Single result */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultItemName}>{result.item}</Text>
            <Text style={styles.resultMeta}>
              {result.day_of_week} · {result.weather} · RM{result.price_rm}
            </Text>
          </View>

          <View style={styles.comparisonCard}>
            <View style={styles.comparisonCol}>
              <Text style={styles.comparisonLabel}>Natural demand</Text>
              <Text style={styles.comparisonValue}>
                {result.base_predicted_sales}
              </Text>
              <Text style={styles.comparisonSub}>no discount</Text>
            </View>
            {result.discount_pct > 0 && (
              <>
                <Text style={styles.comparisonArrow}>→</Text>
                <View style={[styles.comparisonCol, styles.comparisonColHighlight]}>
                  <Text style={styles.comparisonLabel}>
                    {result.discount_pct}% off
                  </Text>
                  <Text style={[styles.comparisonValue, { color: colors.success }]}>
                    {result.predicted_sales}
                  </Text>
                  <Text style={styles.comparisonSub}>
                    +{result.predicted_sales - result.base_predicted_sales} sales
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>
                {result.recommended_production}
              </Text>
              <Text style={styles.metricLabel}>Recommended bake</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      result.expected_surplus > 8 ? colors.error : colors.success,
                  },
                ]}
              >
                {result.expected_surplus}
              </Text>
              <Text style={styles.metricLabel}>Expected surplus</Text>
            </View>
          </View>

          {result.discount_pct > 0 && (
            <View style={styles.revenueCard}>
              <Text style={styles.revenueTitle}>Revenue impact</Text>
              <View style={styles.revenueRow}>
                <Text style={styles.revenueBase}>
                  Base: RM {result.base_revenue_rm}
                </Text>
                <Text style={styles.revenueDiscounted}>
                  Discounted: RM {result.discounted_revenue_rm}
                </Text>
              </View>
              <View
                style={[
                  styles.impactBadge,
                  {
                    backgroundColor:
                      result.revenue_impact >= 0
                        ? colors.successSoft
                        : colors.errorSoft,
                  },
                ]}
              >
                {result.revenue_impact >= 0 ? (
                  <TrendingUp size={14} color={colors.success} />
                ) : (
                  <TrendingDown size={14} color={colors.error} />
                )}
                <Text
                  style={[
                    styles.impactText,
                    {
                      color:
                        result.revenue_impact >= 0
                          ? colors.success
                          : colors.error,
                    },
                  ]}
                >
                  RM {result.revenue_impact > 0 ? "+" : ""}
                  {result.revenue_impact}
                </Text>
              </View>
            </View>
          )}

          {result.surplus_rate > 15 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                High surplus rate ({result.surplus_rate}%) — consider a mystery
                bag discount to reduce waste.
              </Text>
            </View>
          )}

          <Text style={styles.modelInfo}>
            {(result.model_accuracy * 100).toFixed(1)}% accuracy · trained on{" "}
            {result.training_size} records
          </Text>
        </View>
      )}

      {/* Batch result */}
      {batchResult && (
        <View style={styles.resultCard}>
          <Text style={styles.batchTitle}>
            Full day plan · {batchResult.day}
            {batchResult.discount_pct > 0
              ? ` (${batchResult.discount_pct}% off)`
              : ""}
          </Text>

          {batchResult.predictions.map((item, idx) => (
              <View key={idx} style={styles.batchItem}>
                <View style={styles.batchItemHeader}>
                  <Text style={styles.batchItemName}>{item.item}</Text>
                  <View style={styles.surplusPill}>
                    <Text style={styles.surplusPillText}>
                      Surplus {item.expected_surplus}
                    </Text>
                  </View>
                </View>
                <View style={styles.batchBar}>
                  <View
                    style={[
                      styles.batchBarSales,
                      { flex: item.predicted_sales || 0.1 },
                    ]}
                  />
                  <View
                    style={[
                      styles.batchBarSurplus,
                      { flex: item.expected_surplus || 0.1 },
                    ]}
                  />
                </View>
                <Text style={styles.batchItemStats}>
                  Bake {item.recommended_production} → sell ~{item.predicted_sales}
                  {batchResult.discount_pct > 0 &&
                    ` (base: ${item.base_predicted_sales})`}
                </Text>
              </View>
          ))}

          <View style={styles.batchTotal}>
            <Text style={styles.batchTotalText}>
              Total bake: {batchResult.total_recommended_production}
            </Text>
            <Text style={styles.batchTotalSub}>
              Total surplus: {batchResult.total_expected_surplus}
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.md,
    backgroundColor: "transparent",
  },
  loadingWrap: {
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  cafeName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 1,
  },
  retrainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retrainText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  chipScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
  },
  chipTextActive: {
    color: colors.white,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 44,
    alignItems: "center",
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
  },
  weatherRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  weatherChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weatherChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
  },
  weatherTextActive: {
    color: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  discountCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.1)",
  },
  discountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  discountTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 2,
  },
  discountDesc: {
    fontSize: 12,
    color: colors.textSoft,
  },
  discountBody: {
    marginTop: spacing.sm,
  },
  discountHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 6,
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  predictBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  predictBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  batchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    minHeight: 48,
  },
  batchBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.12)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  resultHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultItemName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  resultMeta: {
    fontSize: 13,
    color: colors.textSoft,
  },
  comparisonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  comparisonCol: {
    flex: 1,
    alignItems: "center",
  },
  comparisonColHighlight: {
    backgroundColor: colors.successSoft,
    borderRadius: 10,
    padding: spacing.sm,
  },
  comparisonLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  comparisonValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  comparisonSub: {
    fontSize: 10,
    color: colors.textSoft,
    marginTop: 2,
  },
  comparisonArrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: "700",
    marginHorizontal: 4,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  metricBox: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
    textAlign: "center",
  },
  revenueCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  revenueTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
    marginBottom: spacing.sm,
  },
  revenueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  revenueBase: {
    fontSize: 12,
    color: colors.textSoft,
  },
  revenueDiscounted: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  impactBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  impactText: {
    fontSize: 15,
    fontWeight: "800",
  },
  warningBox: {
    backgroundColor: colors.errorSoft,
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: 12,
    color: colors.error,
    lineHeight: 18,
    fontWeight: "500",
  },
  modelInfo: {
    fontSize: 11,
    color: colors.textSoft,
    textAlign: "center",
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  batchItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  batchItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  batchItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  surplusPill: {
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  surplusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.error,
  },
  batchBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  batchBarSales: {
    backgroundColor: colors.primary,
  },
  batchBarSurplus: {
    backgroundColor: colors.error,
  },
  batchItemStats: {
    fontSize: 11,
    color: colors.textSoft,
  },
  batchTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    alignItems: "center",
  },
  batchTotalText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  batchTotalSub: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
});
