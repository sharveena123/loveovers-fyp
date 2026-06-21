import { Text } from "@/src/components/StyledText";
import { colors, spacing } from "@/src/theme/styles";
import { BarChart3, ClipboardList, RefreshCw, Sparkles } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { batchPredict, getCafeInfo, predictForCafe } from "../../ai/api";
import { getAiErrorMessage, isAiNotFoundError } from "../../ai/errors";
import { BatchPredictionResponse, PredictionResponse } from "../../ai/types";
import { DailySalesEntryScreen } from "./DailySalesEntryScreen";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const HOW_TO_USE = [
  "Choose what you are baking and which day you are preparing for.",
  "Tap Get suggestion for one item, or Whole menu for everything at once.",
  "Use the numbers as a starting point — bake a little more if you never want to run out.",
];

interface PredictionScreenProps {
  cafeId: string;
  simulatorClosingHour?: number;
  onModelNotFound?: () => void;
  onRetrain?: () => void;
}

type AiTab = "predict" | "daily";

export function PredictionScreen({
  cafeId,
  simulatorClosingHour = 20,
  onModelNotFound,
  onRetrain,
}: PredictionScreenProps) {
  const [activeTab, setActiveTab] = useState<AiTab>("predict");
  const [cafeName, setCafeName] = useState("");
  const [cafeItems, setCafeItems] = useState<string[]>([]);
  const [trainingRows, setTrainingRows] = useState(0);
  const [accuracyPct, setAccuracyPct] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedDay, setSelectedDay] = useState("Saturday");
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchPredictionResponse | null>(
    null,
  );
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
        training_rows?: number;
        r2?: number;
        accuracy_pct?: number;
      };
      setCafeName(info.cafe_name);
      setCafeItems(info.items);
      setTrainingRows(info.training_rows ?? 0);
      setAccuracyPct(
        info.accuracy_pct ?? (info.r2 != null ? info.r2 * 100 : null),
      );
      if (info.items.length > 0) setSelectedItem(info.items[0]);
    } catch (error: unknown) {
      const { title, message } = getAiErrorMessage(error, "load");
      Alert.alert(title, message, [{ text: "OK" }]);
      if (isAiNotFoundError(error)) {
        onModelNotFound?.();
      }
    } finally {
      setLoadingCafe(false);
    }
  };

  const handlePredict = async () => {
    if (!cafeId) {
      Alert.alert("Upload sales file first", "Add your past sales file before getting bake suggestions.");
      return;
    }

    try {
      setLoading(true);
      setBatchResult(null);
      const response = await predictForCafe({
        cafe_id: cafeId,
        item: selectedItem,
        day_of_week: selectedDay as "Monday",
      });
      setResult(response);
    } catch (error) {
      const { title, message } = getAiErrorMessage(error, "predict");
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPredict = async () => {
    if (!cafeId) {
      Alert.alert("Upload sales file first", "Add your past sales file before getting bake suggestions.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      const response = await batchPredict(cafeId, selectedDay as "Monday");
      setBatchResult(response);
    } catch (error) {
      const { title, message } = getAiErrorMessage(error, "batch_predict");
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCafe) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your bake planner…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Sparkles size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cafeName} numberOfLines={1}>
              {cafeName}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === "predict"
                ? "How much should I bake?"
                : "Record what you sold today"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.retrainBtn}
          onPress={() => onRetrain?.()}
          activeOpacity={0.85}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={styles.retrainText}>Change file</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "predict" && styles.tabActive]}
          onPress={() => setActiveTab("predict")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "predict" && styles.tabTextActive,
            ]}
          >
            Get suggestions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "daily" && styles.tabActive]}
          onPress={() => setActiveTab("daily")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "daily" && styles.tabTextActive,
            ]}
          >
            Log sales
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "daily" ? (
        <DailySalesEntryScreen
          cafeId={cafeId}
          simulatorClosingHour={simulatorClosingHour}
          onSaved={() => loadCafeInfo()}
        />
      ) : (
        <>
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <ClipboardList size={18} color={colors.primary} />
              <Text style={styles.guideTitle}>How to use this</Text>
            </View>
            {HOW_TO_USE.map((line, i) => (
              <View key={i} style={styles.guideRow}>
                <Text style={styles.guideStep}>{i + 1}.</Text>
                <Text style={styles.guideText}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.fieldLabel}>What are you baking?</Text>
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

          <Text style={styles.fieldLabel}>Which day?</Text>
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
                <Text style={styles.predictBtnText}>Get suggestion</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.batchBtn, loading && styles.btnDisabled]}
              onPress={handleBatchPredict}
              disabled={loading}
              activeOpacity={0.88}
            >
              <BarChart3 size={18} color={colors.primary} />
              <Text style={styles.batchBtnText}>Whole menu</Text>
            </TouchableOpacity>
          </View>

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                {result.item} · {result.day_of_week}
              </Text>
              <Text style={styles.resultLead}>
                Based on your past sales, here is a simple plan for the day.
              </Text>

              <View style={styles.planRow}>
                <View style={styles.planBox}>
                  <Text style={styles.planNumber}>{result.predicted_sales}</Text>
                  <Text style={styles.planLabel}>Likely to sell</Text>
                </View>
                <Text style={styles.planArrow}>→</Text>
                <View style={[styles.planBox, styles.planBoxHighlight]}>
                  <Text style={[styles.planNumber, styles.planNumberHighlight]}>
                    {result.recommended_production}
                  </Text>
                  <Text style={styles.planLabel}>Bake this many</Text>
                </View>
              </View>

              {result.expected_surplus > 0 && (
                <View style={styles.leftoverBox}>
                  <Text style={styles.leftoverText}>
                    About {result.expected_surplus} may be left over — list them
                    as mystery bags near closing time to reduce waste.
                  </Text>
                </View>
              )}

              <Text style={styles.statsFooter}>
                {(result.model_accuracy * 100).toFixed(1)}% accuracy · based on{" "}
                {result.training_size} sales rows
              </Text>
            </View>
          )}

          {batchResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                Whole menu · {batchResult.day}
              </Text>
              <Text style={styles.resultLead}>
                Suggested amounts for each item on this day.
              </Text>

              {batchResult.predictions.map((item, idx) => (
                <View key={idx} style={styles.batchItem}>
                  <Text style={styles.batchItemName}>{item.item}</Text>
                  <Text style={styles.batchItemPlan}>
                    Bake {item.recommended_production} · expect to sell around{" "}
                    {item.predicted_sales}
                  </Text>
                  {item.expected_surplus > 0 ? (
                    <Text style={styles.batchItemLeftover}>
                      ~{item.expected_surplus} may be left over
                    </Text>
                  ) : null}
                </View>
              ))}

              <View style={styles.batchTotal}>
                <Text style={styles.batchTotalText}>
                  Total to bake: {batchResult.total_recommended_production}
                </Text>
                <Text style={styles.batchTotalSub}>
                  Expected sales: {batchResult.total_predicted_sales}
                </Text>
              </View>

              {accuracyPct != null && trainingRows > 0 ? (
                <Text style={styles.statsFooter}>
                  {accuracyPct.toFixed(1)}% accuracy · based on {trainingRows}{" "}
                  sales rows
                </Text>
              ) : null}
            </View>
          )}
        </>
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
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSoft,
  },
  tabTextActive: {
    color: colors.white,
  },
  guideCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  guideRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: 6,
  },
  guideStep: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    width: 18,
  },
  guideText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 19,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
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
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  resultLead: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
  },
  planBox: {
    flex: 1,
    alignItems: "center",
  },
  planBoxHighlight: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingVertical: spacing.sm,
  },
  planNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  planNumberHighlight: {
    color: colors.primary,
  },
  planLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  planArrow: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "700",
    marginHorizontal: 4,
  },
  leftoverBox: {
    marginTop: spacing.md,
    backgroundColor: colors.errorSoft,
    borderRadius: 10,
    padding: spacing.sm,
  },
  leftoverText: {
    fontSize: 12,
    color: colors.error,
    lineHeight: 18,
  },
  batchItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  batchItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  batchItemPlan: {
    fontSize: 13,
    color: colors.text,
  },
  batchItemLeftover: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  batchTotal: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    alignItems: "center",
  },
  batchTotalText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  batchTotalSub: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  statsFooter: {
    fontSize: 11,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
