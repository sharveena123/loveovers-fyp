// src/screens/UploadAndTrainScreen.tsx - HYBRID VERSION
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { assessDataset, trainModel } from "../../ai/api";
import {
    DatasetAssessment,
    NeedsConfirmation,
    TrainingResult,
} from "../../ai/types";

export default function UploadAndTrainScreen() {
  const [file, setFile] = useState<any>(null);
  const [cafeName, setCafeName] = useState("");
  const [assessment, setAssessment] = useState<DatasetAssessment | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<
    "upload" | "assess" | "confirm" | "train" | "done"
  >("upload");

  // Layer 3: User corrections
  const [userCorrections, setUserCorrections] = useState<
    Record<string, string>
  >({});

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "text/csv",
      copyToCacheDirectory: true,
    });

    if (result.assets && result.assets.length > 0) {
      setFile(result.assets[0]);
      setStep("upload");
      setAssessment(null);
      setTrainingResult(null);
      setUserCorrections({});
    }
  };

  const handleAssess = async () => {
    if (!file) {
      Alert.alert("Error", "Please select a CSV file first");
      return;
    }

    try {
      setLoading(true);
      const result = await assessDataset(
        file.uri,
        file.name,
        cafeName || "My Cafe",
      );
      setAssessment(result);

      if (result.needs_confirmation.length > 0) {
        setStep("confirm");
      } else {
        setStep(result.usable ? "train" : "assess");
      }

      if (!result.usable && result.needs_confirmation.length === 0) {
        Alert.alert(
          "Dataset Issues",
          `Missing required: ${result.missing_required.join(", ")}`,
        );
      }
    } catch (error) {
      Alert.alert("Assessment Failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionChange = (column: string, standard: string) => {
    setUserCorrections((prev) => ({
      ...prev,
      [column]: standard,
    }));
  };

  const handleTrain = async () => {
    if (!assessment?.usable) {
      Alert.alert("Cannot Train", "Please fix dataset issues first.");
      return;
    }

    try {
      setLoading(true);
      const result = await trainModel(
        file.uri,
        file.name,
        cafeName || "My Cafe",
        undefined,
        Object.keys(userCorrections).length > 0 ? userCorrections : undefined,
      );
      setTrainingResult(result);
      setStep("done");

      Alert.alert(
        "Training Complete!",
        `Model trained for ${result.cafe_name}\n` +
          `Items: ${result.items.length}\n` +
          `Accuracy: ${(result.r2 * 100).toFixed(1)}%`,
      );
    } catch (error) {
      Alert.alert("Training Failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "#27AE60";
      case "medium":
        return "#F39C12";
      case "low":
        return "#E74C3C";
      default:
        return "#7F8C8D";
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "✅";
      case "medium":
        return "⚠️";
      case "low":
        return "❌";
      default:
        return "❓";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📤 Upload & Train AI Model</Text>

      {/* Step 1: Upload */}
      <View style={styles.stepBox}>
        <Text style={styles.stepTitle}>Step 1: Select CSV File</Text>
        <Text style={styles.stepDesc}>
          Upload your sales data. Our AI handles any format.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Cafe Name (optional)"
          value={cafeName}
          onChangeText={setCafeName}
        />

        <TouchableOpacity style={styles.uploadButton} onPress={pickFile}>
          <Text style={styles.uploadButtonText}>
            {file ? `📄 ${file.name}` : "📁 Select CSV File"}
          </Text>
        </TouchableOpacity>

        {file && (
          <TouchableOpacity style={styles.actionButton} onPress={handleAssess}>
            <Text style={styles.actionButtonText}>
              {loading ? "Analyzing..." : "🔍 AI Assess Dataset"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Assessment Results */}
      {assessment && (
        <View
          style={[
            styles.stepBox,
            { borderColor: getConfidenceColor(assessment.confidence) },
          ]}
        >
          <Text style={styles.stepTitle}>
            Step 2: AI Assessment Result{" "}
            {getConfidenceIcon(assessment.confidence)}
          </Text>

          {/* Confidence Score */}
          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: getConfidenceColor(assessment.confidence) },
            ]}
          >
            <Text style={styles.confidenceText}>
              {assessment.confidence.toUpperCase()} CONFIDENCE
            </Text>
          </View>

          {/* Layer Breakdown */}
          <View style={styles.layerBox}>
            <Text style={styles.layerTitle}>
              🧠 How AI Mapped Your Columns:
            </Text>
            <View style={styles.layerRow}>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown.rule_based_mapped}
                </Text>
                <Text style={styles.layerLabel}>Rule-Based</Text>
              </View>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown.llm_mapped}
                </Text>
                <Text style={styles.layerLabel}>AI (Gemini)</Text>
              </View>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown.needs_confirmation}
                </Text>
                <Text style={styles.layerLabel}>Need You</Text>
              </View>
            </View>
          </View>

          {/* Detected Mappings */}
          <Text style={styles.sectionTitle}>✅ Auto-Detected Columns:</Text>
          {Object.entries(assessment.detected_mapping).map(
            ([standard, original]) => (
              <View key={standard} style={styles.mappingRow}>
                <Text style={styles.mappingOriginal}>{original}</Text>
                <Text style={styles.mappingArrow}>→</Text>
                <Text style={styles.mappingStandard}>{standard}</Text>
              </View>
            ),
          )}

          {/* LLM-Assisted Mappings */}
          {Object.keys(assessment.llm_assisted_mapping).length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: "#9B59B6" }]}>
                🤖 AI-Assisted Columns:
              </Text>
              {Object.entries(assessment.llm_assisted_mapping).map(
                ([col, standard]) => (
                  <View
                    key={col}
                    style={[styles.mappingRow, { backgroundColor: "#F3E5F5" }]}
                  >
                    <Text style={styles.mappingOriginal}>{col}</Text>
                    <Text style={styles.mappingArrow}>→</Text>
                    <Text
                      style={[styles.mappingStandard, { color: "#9B59B6" }]}
                    >
                      {standard}
                    </Text>
                    <Text style={styles.llmBadge}>AI</Text>
                  </View>
                ),
              )}
            </>
          )}

          {/* Needs Confirmation */}
          {assessment.needs_confirmation.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: "#E74C3C" }]}>
                ❓ Needs Your Confirmation:
              </Text>
              {assessment.needs_confirmation.map((item: NeedsConfirmation) => (
                <View key={item.column} style={styles.confirmationCard}>
                  <Text style={styles.confirmationColumn}>{item.column}</Text>
                  <Text style={styles.confirmationSuggest}>
                    AI suggests:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {item.suggested_mapping}
                    </Text>
                  </Text>
                  <View style={styles.pickerRow}>
                    {item.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionChip,
                          (userCorrections[item.column] ||
                            item.suggested_mapping) === option &&
                            styles.optionChipSelected,
                        ]}
                        onPress={() =>
                          handleCorrectionChange(item.column, option)
                        }
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            (userCorrections[item.column] ||
                              item.suggested_mapping) === option &&
                              styles.optionChipTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Issues & Suggestions */}
          {assessment.data_quality_issues.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: "#E74C3C" }]}>
                ⚠️ Data Quality Issues:
              </Text>
              {assessment.data_quality_issues.map((issue, i) => (
                <Text key={i} style={styles.issueText}>
                  • {issue}
                </Text>
              ))}
            </>
          )}

          {assessment.suggestions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>💡 AI Suggestions:</Text>
              {assessment.suggestions.map((s, i) => (
                <Text key={i} style={styles.suggestionText}>
                  • {s}
                </Text>
              ))}
            </>
          )}

          {/* Train Button */}
          {assessment.usable && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: "#27AE60", marginTop: 16 },
              ]}
              onPress={handleTrain}
            >
              <Text style={styles.actionButtonText}>
                {loading ? "Training..." : "🚀 Train AI Model"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Step 3: Training Complete */}
      {trainingResult && (
        <View style={[styles.stepBox, { borderColor: "#3498DB" }]}>
          <Text style={styles.stepTitle}>Step 3: Training Complete! 🎉</Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultCafeName}>
              {trainingResult.cafe_name}
            </Text>
            <Text style={styles.resultId}>ID: {trainingResult.cafe_id}</Text>

            <View style={styles.statGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trainingResult.rows_used}</Text>
                <Text style={styles.statLabel}>Rows Trained</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {trainingResult.items.length}
                </Text>
                <Text style={styles.statLabel}>Menu Items</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(trainingResult.r2 * 100).toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Your Menu Items:</Text>
            <View style={styles.itemsList}>
              {trainingResult.items.map((item) => (
                <View key={item} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.readyText}>
              ✅ Ready for predictions! Go to AI Predict tab.
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#2C3E50",
  },
  stepBox: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#ECF0F1",
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },
  stepDesc: { fontSize: 13, color: "#7F8C8D", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#BDC3C7",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: "#ECF0F1",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#BDC3C7",
  },
  uploadButtonText: { color: "#2C3E50", fontWeight: "600" },
  actionButton: {
    backgroundColor: "#3498DB",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  actionButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // Confidence Badge
  confidenceBadge: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  confidenceText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  // Layer Breakdown
  layerBox: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  layerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 8,
  },
  layerRow: { flexDirection: "row", justifyContent: "space-around" },
  layerItem: { alignItems: "center" },
  layerNumber: { fontSize: 20, fontWeight: "bold", color: "#3498DB" },
  layerLabel: { fontSize: 11, color: "#7F8C8D", marginTop: 2 },

  // Mappings
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginTop: 12,
    marginBottom: 6,
  },
  mappingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
    marginBottom: 4,
  },
  mappingOriginal: { fontSize: 12, color: "#2C3E50", flex: 1 },
  mappingArrow: { fontSize: 12, color: "#7F8C8D", marginHorizontal: 8 },
  mappingStandard: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#27AE60",
    flex: 1,
  },
  llmBadge: {
    backgroundColor: "#9B59B6",
    color: "#fff",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "bold",
  },

  // Confirmation
  confirmationCard: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#F39C12",
  },
  confirmationColumn: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  confirmationSuggest: {
    fontSize: 12,
    color: "#7F8C8D",
    marginTop: 2,
    marginBottom: 8,
  },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#ECF0F1",
    borderWidth: 1,
    borderColor: "#BDC3C7",
  },
  optionChipSelected: { backgroundColor: "#3498DB", borderColor: "#3498DB" },
  optionChipText: { fontSize: 11, color: "#2C3E50" },
  optionChipTextSelected: { color: "#fff", fontWeight: "600" },

  // Issues & Suggestions
  issueText: { fontSize: 12, color: "#E74C3C", marginLeft: 8, marginBottom: 2 },
  suggestionText: {
    fontSize: 12,
    color: "#3498DB",
    marginLeft: 8,
    marginBottom: 2,
    fontStyle: "italic",
  },

  // Result
  resultCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  resultCafeName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2C3E50",
    textAlign: "center",
  },
  resultId: {
    fontSize: 11,
    color: "#7F8C8D",
    textAlign: "center",
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 12,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold", color: "#3498DB" },
  statLabel: { fontSize: 11, color: "#7F8C8D" },
  itemsList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  itemChip: {
    backgroundColor: "#ECF0F1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemChipText: { fontSize: 12, color: "#2C3E50" },
  readyText: {
    fontSize: 14,
    color: "#27AE60",
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 16,
  },
});
