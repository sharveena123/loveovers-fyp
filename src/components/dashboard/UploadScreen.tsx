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
import { DatasetAssessment, TrainingResult } from "../../ai/types";

interface UploadAndTrainScreenProps {
  onTrainingComplete?: (cafeId: string) => void;
}

export function UploadAndTrainScreen({
  onTrainingComplete,
}: UploadAndTrainScreenProps) {
  const [file, setFile] = useState<any>(null);
  const [cafeName, setCafeName] = useState("");
  const [assessment, setAssessment] = useState<DatasetAssessment | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<
    "upload" | "assessing" | "review" | "training" | "done"
  >("upload");

  // User corrections (v4.2 — derived from editable_mapping)
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
      setStep("assessing");
      const result = await assessDataset(
        file.uri,
        file.name,
        cafeName || "My Cafe",
      );
      setAssessment(result);
      setStep("review");

      // v4.2: Initialize userCorrections from editable_mapping
      const initialCorrections: Record<string, string> = {};
      for (const entry of result.editable_mapping || []) {
        initialCorrections[entry.original_column] = entry.current_mapping;
      }
      setUserCorrections(initialCorrections);
    } catch (error: any) {
      Alert.alert("Assessment Failed", String(error));
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (column: string, standard: string) => {
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
    if (!assessment.assessment_id) {
      Alert.alert("Error", "No assessment ID found.");
      return;
    }

    try {
      setLoading(true);
      setStep("training");

      // v4.2 path only — always use assessment_id with Ollama backend
      const result = await trainModel(
        file.uri,
        file.name,
        cafeName || "My Cafe",
        assessment.assessment_id,
      );

      setTrainingResult(result);
      setStep("done");

      Alert.alert(
        "Training Complete! 🎉",
        `Model trained for ${result.cafe_name}\n` +
          `Items: ${result.items.length}\n` +
          `Accuracy: ${(result.r2 * 100).toFixed(1)}%`,
      );

      if (onTrainingComplete) {
        onTrainingComplete(result.cafe_id);
      }
    } catch (error: any) {
      Alert.alert("Training Failed", String(error));
      setStep("review");
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

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "rule":
        return "📋";
      case "llm":
        return "🤖";
      case "unmapped":
        return "❓";
      default:
        return "❓";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "rule":
        return "Rule-based";
      case "llm":
        return "AI (Ollama)";
      case "unmapped":
        return "Needs You";
      default:
        return "Unknown";
    }
  };

  // v4.2: editable_mapping is always present from Ollama backend
  const editableMapping = assessment?.editable_mapping || [];

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
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAssess}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              {loading && step === "assessing"
                ? "Analyzing with AI..."
                : "🔍 AI Assess Dataset"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Review AI Assessment */}
      {assessment && (
        <View
          style={[
            styles.stepBox,
            { borderColor: getConfidenceColor(assessment.confidence) },
          ]}
        >
          <Text style={styles.stepTitle}>
            Step 2: AI Assessment Result{" "}
            {assessment.confidence === "high"
              ? "✅"
              : assessment.confidence === "medium"
                ? "⚠️"
                : "❌"}
          </Text>

          {/* Confidence Badge */}
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

          {/* AI Engine Badge */}
          {assessment.ai_engine && (
            <View style={styles.engineBadge}>
              <Text style={styles.engineBadgeText}>
                🤖 Engine:{" "}
                {assessment.ai_engine === "ollama"
                  ? "Ollama (Local)"
                  : "Rule-based Only"}
              </Text>
            </View>
          )}

          {/* Layer Breakdown */}
          <View style={styles.layerBox}>
            <Text style={styles.layerTitle}>
              🧠 How AI Mapped Your Columns:
            </Text>
            <View style={styles.layerRow}>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown?.rule_based_mapped || 0}
                </Text>
                <Text style={styles.layerLabel}>Rule-Based</Text>
              </View>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown?.llm_mapped || 0}
                </Text>
                <Text style={styles.layerLabel}>AI (Ollama)</Text>
              </View>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown?.needs_confirmation || 0}
                </Text>
                <Text style={styles.layerLabel}>Need You</Text>
              </View>
            </View>

            {/* Diagnostic Info */}
            {assessment.diagnostic && (
              <View style={styles.diagnosticBox}>
                <Text style={styles.diagnosticText}>
                  {assessment.diagnostic}
                </Text>
              </View>
            )}
          </View>

          {/* Editable Mapping Table */}
          <Text style={styles.sectionTitle}>
            📝 Review & Edit Column Mappings:
          </Text>
          <Text style={styles.editHint}>
            Tap any dropdown to change the mapping.
          </Text>

          {editableMapping.map((entry) => {
            const currentValue =
              userCorrections[entry.original_column] || entry.current_mapping;
            const isModified =
              userCorrections[entry.original_column] !== undefined &&
              userCorrections[entry.original_column] !==
                entry.ai_suggested_mapping;

            return (
              <View
                key={entry.original_column}
                style={[
                  styles.mappingCard,
                  entry.source === "llm" && styles.mappingCardLLM,
                  entry.source === "unmapped" && styles.mappingCardUnmapped,
                  isModified && styles.mappingCardModified,
                ]}
              >
                <View style={styles.mappingHeader}>
                  <Text style={styles.mappingColumn}>
                    {entry.original_column}
                  </Text>
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {getSourceIcon(entry.source)}{" "}
                      {getSourceLabel(entry.source)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.mappingCurrent}>
                  Maps to:{" "}
                  <Text style={{ fontWeight: "bold", color: "#2C3E50" }}>
                    {currentValue}
                  </Text>
                  {isModified && (
                    <Text style={styles.modifiedTag}> (edited by you)</Text>
                  )}
                </Text>

                <View style={styles.optionsRow}>
                  {(
                    entry.options || [
                      "date",
                      "item",
                      "sold_qty",
                      "produced_qty",
                      "price",
                      "discount_pct",
                      "weather",
                      "day_of_week",
                      "unknown",
                    ]
                  ).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionChip,
                        currentValue === option && styles.optionChipSelected,
                      ]}
                      onPress={() =>
                        handleMappingChange(entry.original_column, option)
                      }
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          currentValue === option &&
                            styles.optionChipTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Issues */}
          {(assessment.data_quality_issues || []).length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: "#E74C3C" }]}>
                ⚠️ Data Quality Issues:
              </Text>
              {(assessment.data_quality_issues || []).map(
                (issue: string, i: number) => (
                  <Text key={i} style={styles.issueText}>
                    • {issue}
                  </Text>
                ),
              )}
            </>
          )}

          {(assessment.suggestions || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>💡 AI Suggestions:</Text>
              {(assessment.suggestions || []).map((s: string, i: number) => (
                <Text key={i} style={styles.suggestionText}>
                  • {s}
                </Text>
              ))}
            </>
          )}

          {/* Missing Required Warning */}
          {(assessment.missing_required || []).length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ❌ Missing required:{" "}
                {(assessment.missing_required || []).join(", ")}
              </Text>
              <Text style={styles.warningSub}>
                Please map these above before training.
              </Text>
            </View>
          )}

          {/* Train Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: assessment.usable ? "#27AE60" : "#BDC3C7",
                marginTop: 16,
              },
            ]}
            onPress={handleTrain}
            disabled={!assessment.usable || loading}
          >
            <Text style={styles.actionButtonText}>
              {loading && step === "training"
                ? "Training XGBoost Model..."
                : assessment.usable
                  ? "🚀 Train AI Model"
                  : "🔧 Fix Mappings to Train"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 3: Done */}
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

  confidenceBadge: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  confidenceText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  engineBadge: {
    alignSelf: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  engineBadgeText: { color: "#1565C0", fontWeight: "600", fontSize: 12 },

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

  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginTop: 12,
    marginBottom: 6,
  },
  editHint: {
    fontSize: 12,
    color: "#F39C12",
    fontStyle: "italic",
    marginBottom: 12,
  },

  mappingCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#3498DB",
  },
  mappingCardLLM: {
    borderLeftColor: "#9B59B6",
    backgroundColor: "#F3E5F5",
  },
  mappingCardUnmapped: {
    borderLeftColor: "#F39C12",
    backgroundColor: "#FFF8E1",
  },
  mappingCardModified: {
    borderLeftColor: "#27AE60",
    backgroundColor: "#E8F5E9",
  },
  mappingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  mappingColumn: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  sourceBadge: {
    backgroundColor: "#ECF0F1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: { fontSize: 11, color: "#2C3E50" },
  mappingCurrent: { fontSize: 12, color: "#7F8C8D", marginBottom: 8 },
  modifiedTag: { color: "#27AE60", fontWeight: "bold" },

  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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

  issueText: { fontSize: 12, color: "#E74C3C", marginLeft: 8, marginBottom: 2 },
  suggestionText: {
    fontSize: 12,
    color: "#3498DB",
    marginLeft: 8,
    marginBottom: 2,
    fontStyle: "italic",
  },

  warningBox: {
    backgroundColor: "#FADBD8",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: { fontSize: 13, color: "#C0392B", fontWeight: "bold" },
  warningSub: { fontSize: 11, color: "#E74C3C", marginTop: 4 },

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
  diagnosticBox: {
    backgroundColor: "#E3F2FD",
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#2196F3",
  },
  diagnosticText: {
    fontSize: 12,
    color: "#1565C0",
    fontWeight: "500",
  },
});
