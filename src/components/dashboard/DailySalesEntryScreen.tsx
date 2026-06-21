import { Text, TextInput } from "@/src/components/StyledText";
import {
  getCafeDataset,
  getCafeInfo,
  recordDailySales,
  retrainCafe,
} from "@/src/ai/api";
import { getAiErrorMessage } from "@/src/ai/errors";
import { DayOfWeek, RecordDailySalesResponse, Weather } from "@/src/ai/types";
import { colors, spacing } from "@/src/theme/styles";
import { suggestedSimulatorDiscountPct } from "@/src/services/pricing/dynamicPricing";
import {
  Calendar,
  CheckCircle2,
  Cloud,
  CloudRain,
  ClipboardList,
  RefreshCw,
  Save,
  Sun,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

const WEATHERS: { label: string; value: Weather; icon: typeof Sun }[] = [
  { label: "Sunny", value: "Sunny", icon: Sun },
  { label: "Cloudy", value: "Cloudy", icon: Cloud },
  { label: "Rainy", value: "Rainy", icon: CloudRain },
];

const DAY_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function dayFromDate(dateStr: string): DayOfWeek {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Monday";
  return DAY_NAMES[d.getDay()];
}

type ItemEntry = {
  sold: string;
  produced: string;
  price: string;
};

interface DailySalesEntryScreenProps {
  cafeId: string;
  /** Matches seller profile closing hour for default store discount %. */
  simulatorClosingHour?: number;
  onSaved?: () => void;
}

export function DailySalesEntryScreen({
  cafeId,
  simulatorClosingHour = 20,
  onSaved,
}: DailySalesEntryScreenProps) {
  const [cafeName, setCafeName] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [saleDate, setSaleDate] = useState(todayIso());
  const [selectedWeather, setSelectedWeather] = useState<Weather>("Sunny");
  const [storeDiscount, setStoreDiscount] = useState(() =>
    String(suggestedSimulatorDiscountPct(new Date(), simulatorClosingHour)),
  );
  const [retrainAfterSave, setRetrainAfterSave] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<RecordDailySalesResponse | null>(
    null,
  );
  const [datasetRows, setDatasetRows] = useState(0);
  const [manualRows, setManualRows] = useState(0);

  useEffect(() => {
    setStoreDiscount(
      String(suggestedSimulatorDiscountPct(new Date(), simulatorClosingHour)),
    );
  }, [simulatorClosingHour, cafeId]);

  const initEntries = useCallback((itemList: string[]) => {
    setEntries((prev) => {
      const next: Record<string, ItemEntry> = {};
      for (const item of itemList) {
        next[item] = prev[item] ?? { sold: "", produced: "", price: "" };
      }
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!cafeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [info, dataset] = await Promise.all([
        getCafeInfo(cafeId),
        getCafeDataset(cafeId).catch(() => null),
      ]);
      setCafeName(info.cafe_name);
      const itemList = info.items?.length ? info.items : [];
      setItems(itemList);
      initEntries(itemList);

      const summary = dataset?.summary ?? info.dataset_summary;
      setDatasetRows(summary?.total_rows ?? info.training_rows ?? 0);
      setManualRows(summary?.manual_rows ?? 0);
    } catch (error) {
      const { title, message } = getAiErrorMessage(error, "load");
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  }, [cafeId, initEntries]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateEntry = (
    item: string,
    field: keyof ItemEntry,
    value: string,
  ) => {
    setEntries((prev) => ({
      ...prev,
      [item]: { ...prev[item], [field]: value },
    }));
  };

  const fillFromPredictions = () => {
    Alert.alert(
      "Tip",
      "Run a batch prediction first, then enter actual sold quantities here to improve your model over time.",
    );
  };

  const handleSave = async () => {
    const payloadEntries = items
      .map((item) => {
        const row = entries[item];
        const sold = Number(row?.sold);
        if (!row?.sold?.trim() || Number.isNaN(sold) || sold < 0) return null;
        const produced = row.produced?.trim()
          ? Number(row.produced)
          : undefined;
        const price = row.price?.trim() ? Number(row.price) : undefined;
        return {
          item,
          sold_qty: Math.round(sold),
          ...(produced !== undefined &&
            !Number.isNaN(produced) && { produced_qty: Math.round(produced) }),
          ...(price !== undefined && !Number.isNaN(price) && { price }),
        };
      })
      .filter(Boolean) as {
      item: string;
      sold_qty: number;
      produced_qty?: number;
      price?: number;
    }[];

    if (payloadEntries.length === 0) {
      Alert.alert(
        "Nothing to save",
        "Enter sold quantity for at least one item.",
      );
      return;
    }

    try {
      setSaving(true);
      const response = await recordDailySales(cafeId, {
        date: saleDate,
        day_of_week: dayFromDate(saleDate),
        weather: selectedWeather,
        discount_pct: Number(storeDiscount) || 0,
        entries: payloadEntries,
        retrain: retrainAfterSave,
      });
      setLastResult(response);
      setDatasetRows(response.dataset_summary?.total_rows ?? datasetRows);
      setManualRows(response.dataset_summary?.manual_rows ?? manualRows + 1);
      onSaved?.();

      const retrainMsg = response.retrain
        ? `\nModel retrained (R² ${(response.retrain.r2 * 100).toFixed(0)}%).`
        : "";

      Alert.alert(
        "Saved",
        `${response.saved_count} item(s) logged for ${response.date}.${retrainMsg}`,
      );

      setEntries((prev) => {
        const cleared: Record<string, ItemEntry> = {};
        for (const item of items) {
          cleared[item] = { sold: "", produced: "", price: prev[item]?.price ?? "" };
        }
        return cleared;
      });
    } catch (error) {
      const { title, message } = getAiErrorMessage(error, "save_sales");
      Alert.alert(title, message);
    } finally {
      setSaving(false);
    }
  };

  const handleRetrainOnly = async () => {
    try {
      setSaving(true);
      const result = await retrainCafe(cafeId);
      Alert.alert(
        "Model retrained",
        `Used ${result.rows_used} rows · R² ${(result.r2 * 100).toFixed(0)}% · MAE ${result.mae}`,
      );
      onSaved?.();
    } catch (error) {
      const { title, message } = getAiErrorMessage(error, "retrain");
      Alert.alert(title, message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading sales form…</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <ClipboardList size={36} color={colors.primary} />
        <Text style={styles.emptyTitle}>No items in model</Text>
        <Text style={styles.emptySub}>
          Train your model from a CSV first — item names come from your training
          dataset.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.infoBanner}>
        <ClipboardList size={18} color={colors.primary} />
        <Text style={styles.infoText}>
          Log what you actually sold today. Data is saved to your backend database
          and merged with your uploaded CSV for better predictions.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{datasetRows}</Text>
          <Text style={styles.statLabel}>Total rows</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{manualRows}</Text>
          <Text style={styles.statLabel}>Manual entries</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Sale date</Text>
      <View style={styles.inputRow}>
        <Calendar size={18} color={colors.textSoft} />
        <TextInput
          style={styles.input}
          value={saleDate}
          onChangeText={setSaleDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSoft}
        />
      </View>
      <Text style={styles.hint}>
        {dayFromDate(saleDate)} · {cafeName}
      </Text>

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
            >
              <Icon size={16} color={active ? colors.white : colors.textSoft} />
              <Text
                style={[styles.weatherText, active && styles.weatherTextActive]}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Store discount % (optional)</Text>
      <TextInput
        style={styles.inputStandalone}
        value={storeDiscount}
        onChangeText={setStoreDiscount}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textSoft}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.fieldLabel}>Items sold</Text>
        <TouchableOpacity onPress={fillFromPredictions}>
          <Text style={styles.linkText}>How to use</Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => (
        <View key={item} style={styles.itemCard}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item}
          </Text>
          <View style={styles.itemFields}>
            <View style={styles.itemField}>
              <Text style={styles.itemFieldLabel}>Sold *</Text>
              <TextInput
                style={styles.itemInput}
                value={entries[item]?.sold ?? ""}
                onChangeText={(v) => updateEntry(item, "sold", v)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSoft}
              />
            </View>
            <View style={styles.itemField}>
              <Text style={styles.itemFieldLabel}>Produced</Text>
              <TextInput
                style={styles.itemInput}
                value={entries[item]?.produced ?? ""}
                onChangeText={(v) => updateEntry(item, "produced", v)}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.textSoft}
              />
            </View>
            <View style={styles.itemField}>
              <Text style={styles.itemFieldLabel}>Price RM</Text>
              <TextInput
                style={styles.itemInput}
                value={entries[item]?.price ?? ""}
                onChangeText={(v) => updateEntry(item, "price", v)}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.textSoft}
              />
            </View>
          </View>
        </View>
      ))}

      <View style={styles.retrainRow}>
        <View style={styles.retrainTextWrap}>
          <Text style={styles.retrainTitle}>Retrain after save</Text>
          <Text style={styles.retrainSub}>
            Updates the XGBoost model with all history (CSV + manual)
          </Text>
        </View>
        <Switch
          value={retrainAfterSave}
          onValueChange={setRetrainAfterSave}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.9}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            <Save size={18} color={colors.white} />
            <Text style={styles.saveBtnText}>Save daily sales</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, saving && styles.btnDisabled]}
        onPress={handleRetrainOnly}
        disabled={saving}
      >
        <RefreshCw size={16} color={colors.primary} />
        <Text style={styles.secondaryBtnText}>Retrain only</Text>
      </TouchableOpacity>

      {lastResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <CheckCircle2 size={20} color={colors.success} />
            <Text style={styles.resultTitle}>Last entry saved</Text>
          </View>
          <Text style={styles.resultBody}>
            {lastResult.saved_count} items on {lastResult.date} ·{" "}
            {lastResult.dataset_summary?.total_rows ?? "—"} rows in database
          </Text>
          {lastResult.retrain && (
            <Text style={styles.resultMeta}>
              Model R² {(lastResult.retrain.r2 * 100).toFixed(0)}% · MAE{" "}
              {lastResult.retrain.mae}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingWrap: {
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSoft,
  },
  emptyWrap: {
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  infoBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  inputStandalone: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  weatherRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  weatherChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  itemFields: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  itemField: {
    flex: 1,
  },
  itemFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSoft,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  itemInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
  },
  retrainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retrainTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  retrainTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  retrainSub: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
    lineHeight: 17,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: spacing.sm,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.2)",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.success,
  },
  resultBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.sm,
  },
});
