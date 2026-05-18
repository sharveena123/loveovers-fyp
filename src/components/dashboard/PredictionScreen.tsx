// src/components/dashboard/PredictionScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  { label: "☀️ Sunny", value: "Sunny" },
  { label: "☁️ Cloudy", value: "Cloudy" },
  { label: "🌧️ Rainy", value: "Rainy" },
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

  // DISCOUNT IS APP-ONLY: toggle for "what if" scenario
  const [useDiscount, setUseDiscount] = useState(false);
  const [discount, setDiscount] = useState("10");

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCafe, setLoadingCafe] = useState(true);

  useEffect(() => {
    loadCafeInfo();
  }, [cafeId]);

  const loadCafeInfo = async () => {
    if (!cafeId) {
      setLoadingCafe(false);
      return;
    }
    try {
      console.log("Loading cafe info for cafeId:", cafeId);
      const info = (await getCafeInfo(cafeId)) as {
        cafe_name: string;
        items: string[];
      };
      console.log("Cafe info loaded:", info);
      setCafeName(info.cafe_name);
      setCafeItems(info.items);
      if (info.items.length > 0) setSelectedItem(info.items[0]);
    } catch (error: any) {
      console.error("Failed to load cafe info:", error);

      // Check if it's a 404 error (model not found)
      if (error?.message?.includes("404") || error?.status === 404) {
        console.log("Model not found on backend, triggering retrain");
        Alert.alert(
          "Model Not Found",
          "The trained model was not found. Please re-train your model.",
          [{ text: "OK" }],
        );
        // Trigger parent to show upload screen
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
      Alert.alert("No Cafe", "Please upload and train your data first.");
      return;
    }

    try {
      setLoading(true);
      setBatchResult(null);

      const discountPct = useDiscount ? Number(discount) : 0;

      const response = await predictForCafe({
        cafe_id: cafeId,
        item: selectedItem,
        day_of_week: selectedDay as any,
        weather: selectedWeather as any,
        price: Number(price) || 0,
        discount_pct: discountPct,
      });

      setResult(response);
    } catch (error) {
      Alert.alert("Prediction Failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPredict = async () => {
    if (!cafeId) {
      Alert.alert("No Cafe", "Please upload and train your data first.");
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const discountPct = useDiscount ? Number(discount) : 0;

      const response = await batchPredict(
        cafeId,
        selectedDay as any,
        selectedWeather as any,
        discountPct,
      );

      setBatchResult(response);
    } catch (error) {
      Alert.alert("Batch Failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  if (loadingCafe) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={{ marginTop: 12, color: "#7F8C8D" }}>
          Loading cafe data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>🔮 {cafeName}</Text>
          <Text style={styles.subtitle}>AI Surplus Prediction</Text>
        </View>
        <TouchableOpacity
          style={styles.retrainButton}
          onPress={() => onRetrain?.()}
        >
          <Text style={styles.retrainButtonText}>↻ Retrain</Text>
        </TouchableOpacity>
      </View>

      {/* Item Selector */}
      <Text style={styles.label}>Select Item</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
      >
        {cafeItems.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.itemChip,
              selectedItem === item && styles.itemChipActive,
            ]}
            onPress={() => setSelectedItem(item)}
          >
            <Text
              style={[
                styles.itemChipText,
                selectedItem === item && styles.itemChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day Selector */}
      <Text style={styles.label}>Day</Text>
      <View style={styles.chipContainer}>
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayChip,
              selectedDay === day && styles.dayChipActive,
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <Text
              style={[
                styles.dayChipText,
                selectedDay === day && styles.dayChipTextActive,
              ]}
            >
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Weather Selector */}
      <Text style={styles.label}>Weather</Text>
      <View style={styles.chipContainer}>
        {WEATHERS.map((w) => (
          <TouchableOpacity
            key={w.value}
            style={[
              styles.weatherChip,
              selectedWeather === w.value && styles.weatherChipActive,
            ]}
            onPress={() => setSelectedWeather(w.value)}
          >
            <Text
              style={[
                styles.weatherChipText,
                selectedWeather === w.value && styles.weatherChipTextActive,
              ]}
            >
              {w.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Price Input */}
      <Text style={styles.label}>Price (RM)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="6.50"
      />

      {/* DISCOUNT IS APP-ONLY: "What If" Scenario */}
      <View style={styles.discountSection}>
        <View style={styles.discountHeader}>
          <Text style={styles.discountTitle}>🎯 Mystery Bag Discount</Text>
          <Switch
            value={useDiscount}
            onValueChange={setUseDiscount}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={useDiscount ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>

        {useDiscount && (
          <View style={styles.discountInputBox}>
            <Text style={styles.discountDesc}>
              Simulate &quot;what if&quot; we offer discount via Mystery Bag?
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholder="10"
            />
            <Text style={styles.discountHint}>
              {discount}% off → ~{Math.round(Number(discount) * 1.5)}% more
              sales expected
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.predictButton} onPress={handlePredict}>
          <Text style={styles.predictButtonText}>
            {loading ? "Predicting..." : "Predict Item"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.predictButton, styles.batchButton]}
          onPress={handleBatchPredict}
        >
          <Text style={styles.predictButtonText}>
            {loading ? "..." : "Full Day"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Single Result */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultItemName}>{result.item}</Text>
          <Text style={styles.resultMeta}>
            {result.day_of_week} • {result.weather} • RM{result.price_rm}
          </Text>

          {/* Base vs Discounted Comparison */}
          <View style={styles.comparisonBox}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonLabel}>Natural Demand</Text>
              <Text style={styles.comparisonValue}>
                {result.base_predicted_sales}
              </Text>
              <Text style={styles.comparisonSub}>sales (no discount)</Text>
            </View>

            {result.discount_pct > 0 && (
              <>
                <Text style={styles.arrow}>→</Text>
                <View
                  style={[styles.comparisonColumn, styles.discountedColumn]}
                >
                  <Text style={styles.comparisonLabel}>
                    With {result.discount_pct}% Off
                  </Text>
                  <Text style={[styles.comparisonValue, { color: "#27AE60" }]}>
                    {result.predicted_sales}
                  </Text>
                  <Text style={styles.comparisonSub}>
                    sales (+
                    {result.predicted_sales - result.base_predicted_sales})
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {result.recommended_production}
              </Text>
              <Text style={styles.statLabel}>Recommended Bake</Text>
            </View>
            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statNumber,
                  {
                    color: result.expected_surplus > 8 ? "#E74C3C" : "#27AE60",
                  },
                ]}
              >
                {result.expected_surplus}
              </Text>
              <Text style={styles.statLabel}>Expected Surplus</Text>
            </View>
          </View>

          {/* Revenue Impact */}
          {result.discount_pct > 0 && (
            <View style={styles.revenueBox}>
              <Text style={styles.revenueTitle}>💰 Revenue Impact</Text>
              <View style={styles.revenueRow}>
                <Text>Base Revenue: RM {result.base_revenue_rm}</Text>
                <Text style={styles.revenueDiscounted}>
                  Discounted: RM {result.discounted_revenue_rm}
                </Text>
              </View>
              <Text
                style={[
                  styles.revenueImpact,
                  { color: result.revenue_impact >= 0 ? "#27AE60" : "#E74C3C" },
                ]}
              >
                {result.revenue_impact >= 0 ? "📈" : "📉"}
                Impact: RM {result.revenue_impact > 0 ? "+" : ""}
                {result.revenue_impact}
              </Text>
            </View>
          )}

          {result.surplus_rate > 15 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ High surplus rate ({result.surplus_rate}%)! Consider Mystery
                Bag discount to reduce waste.
              </Text>
            </View>
          )}

          <Text style={styles.modelInfo}>
            Model: {(result.model_accuracy * 100).toFixed(1)}% accuracy |
            Trained on {result.training_size} records
          </Text>
        </View>
      )}

      {/* Batch Result */}
      {batchResult && (
        <View style={styles.resultCard}>
          <Text style={styles.batchTitle}>
            📅 Full Day Plan: {batchResult.day}
            {batchResult.discount_pct > 0 &&
              ` (${batchResult.discount_pct}% off)`}
          </Text>

          {batchResult.predictions.map((item: any, idx: number) => (
            <View key={idx} style={styles.batchItem}>
              <View style={styles.batchItemHeader}>
                <Text style={styles.batchItemName}>{item.item}</Text>
                <Text style={styles.batchItemSurplus}>
                  Surplus: {item.expected_surplus}
                </Text>
              </View>
              <View style={styles.batchItemBar}>
                <View
                  style={[
                    styles.batchBarPredicted,
                    { flex: item.predicted_sales },
                  ]}
                />
                <View
                  style={[
                    styles.batchBarBuffer,
                    { flex: item.expected_surplus },
                  ]}
                />
              </View>
              <Text style={styles.batchItemStats}>
                Bake {item.recommended_production} → Sell ~
                {item.predicted_sales}
                {batchResult.discount_pct > 0 &&
                  ` (base: ${item.base_predicted_sales})`}
              </Text>
            </View>
          ))}

          <View style={styles.batchTotal}>
            <Text style={styles.batchTotalText}>
              Total Bake: {batchResult.total_recommended_production} | Total
              Surplus: {batchResult.total_expected_surplus}
            </Text>
          </View>
        </View>
      )}

      {loading && (
        <ActivityIndicator
          style={{ marginTop: 20 }}
          size="large"
          color="#3498DB"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#2C3E50" },
  subtitle: { fontSize: 14, color: "#7F8C8D", marginBottom: 16 },
  retrainButton: {
    backgroundColor: "#34495E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  retrainButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7F8C8D",
    marginTop: 12,
    marginBottom: 8,
  },
  horizontalScroll: { marginBottom: 8 },
  itemChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ECF0F1",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#BDC3C7",
  },
  itemChipActive: { backgroundColor: "#3498DB", borderColor: "#3498DB" },
  itemChipText: { fontSize: 13, color: "#2C3E50" },
  itemChipTextActive: { color: "#fff", fontWeight: "600" },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ECF0F1",
  },
  dayChipActive: { backgroundColor: "#3498DB" },
  dayChipText: { fontSize: 12, color: "#2C3E50" },
  dayChipTextActive: { color: "#fff", fontWeight: "600" },
  weatherChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ECF0F1",
  },
  weatherChipActive: { backgroundColor: "#F39C12" },
  weatherChipText: { fontSize: 12, color: "#2C3E50" },
  weatherChipTextActive: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#BDC3C7",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },

  // Discount Section
  discountSection: {
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F39C12",
  },
  discountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  discountTitle: { fontSize: 14, fontWeight: "bold", color: "#F39C12" },
  discountDesc: { fontSize: 12, color: "#7F8C8D", marginTop: 4 },
  discountInputBox: { marginTop: 8 },
  discountHint: {
    fontSize: 11,
    color: "#95A5A6",
    marginTop: 4,
    fontStyle: "italic",
  },

  buttonRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  predictButton: {
    flex: 1,
    backgroundColor: "#3498DB",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  batchButton: { backgroundColor: "#27AE60" },
  predictButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  resultCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3498DB",
  },
  resultItemName: { fontSize: 20, fontWeight: "bold", color: "#2C3E50" },
  resultMeta: { fontSize: 13, color: "#7F8C8D", marginTop: 2 },

  // Comparison
  comparisonBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  comparisonColumn: { alignItems: "center", flex: 1 },
  discountedColumn: { backgroundColor: "#E8F5E9", padding: 8, borderRadius: 8 },
  comparisonLabel: { fontSize: 11, color: "#7F8C8D", marginBottom: 4 },
  comparisonValue: { fontSize: 28, fontWeight: "bold", color: "#2C3E50" },
  comparisonSub: { fontSize: 10, color: "#95A5A6" },
  arrow: { fontSize: 24, color: "#3498DB", fontWeight: "bold" },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  statBox: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 28, fontWeight: "bold", color: "#2C3E50" },
  statLabel: { fontSize: 11, color: "#7F8C8D", marginTop: 2 },

  revenueBox: {
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  revenueTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#27AE60",
    marginBottom: 8,
  },
  revenueRow: { flexDirection: "row", justifyContent: "space-between" },
  revenueDiscounted: { fontWeight: "bold", color: "#2C3E50" },
  revenueImpact: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },

  warningBox: {
    backgroundColor: "#FADBD8",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: { fontSize: 12, color: "#C0392B" },
  modelInfo: {
    fontSize: 11,
    color: "#95A5A6",
    marginTop: 12,
    textAlign: "center",
  },

  batchTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 12,
  },
  batchItem: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
  },
  batchItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  batchItemName: { fontWeight: "600", color: "#2C3E50" },
  batchItemSurplus: { fontSize: 12, color: "#E74C3C" },
  batchItemBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },
  batchBarPredicted: { backgroundColor: "#3498DB" },
  batchBarBuffer: { backgroundColor: "#E74C3C" },
  batchItemStats: { fontSize: 11, color: "#7F8C8D" },
  batchTotal: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#3498DB",
  },
  batchTotalText: { fontWeight: "bold", color: "#2C3E50", fontSize: 13 },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
