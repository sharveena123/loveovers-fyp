import { Text, TextInput } from "@/src/components/StyledText";
import { colors, spacing } from "@/src/theme/styles";
import * as DocumentPicker from "expo-document-picker";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { assessDataset, trainModel } from "../../ai/api";
import { DatasetAssessment, TrainingResult } from "../../ai/types";

interface UploadAndTrainScreenProps {
  onTrainingComplete?: (cafeId: string) => void;
}

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;

function getStepIndex(
  step: "upload" | "assessing" | "review" | "training" | "done",
): number {
  if (step === "upload" || step === "assessing") return 0;
  if (step === "review" || step === "training") return 1;
  return 2;
}

function getConfidenceStyle(confidence: string) {
  switch (confidence) {
    case "high":
      return { bg: colors.successSoft, text: colors.success, border: colors.success };
    case "medium":
      return { bg: "#fff5e6", text: "#b45309", border: "#f59e0b" };
    default:
      return { bg: colors.errorSoft, text: colors.error, border: colors.error };
  }
}

export function UploadAndTrainScreen({
  onTrainingComplete,
}: UploadAndTrainScreenProps) {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );
  const [cafeName, setCafeName] = useState("");
  const [assessment, setAssessment] = useState<DatasetAssessment | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<
    "upload" | "assessing" | "review" | "training" | "done"
  >("upload");
  const [userCorrections, setUserCorrections] = useState<
    Record<string, string>
  >({});

  const currentStepIndex = getStepIndex(step);

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

      const initialCorrections: Record<string, string> = {};
      for (const entry of result.editable_mapping || []) {
        initialCorrections[entry.original_column] = entry.current_mapping;
      }
      setUserCorrections(initialCorrections);
    } catch (error: unknown) {
      Alert.alert("Assessment Failed", String(error));
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (column: string, standard: string) => {
    setUserCorrections((prev) => ({ ...prev, [column]: standard }));
  };

  const handleTrain = async () => {
    if (!assessment?.usable) {
      Alert.alert("Cannot Train", "Please fix dataset issues first.");
      return;
    }
    if (!assessment.assessment_id || !file) {
      Alert.alert("Error", "No assessment ID found.");
      return;
    }

    try {
      setLoading(true);
      setStep("training");

      const result = await trainModel(
        file.uri,
        file.name,
        cafeName || "My Cafe",
        assessment.assessment_id,
      );

      setTrainingResult(result);
      setStep("done");

      // Switch to prediction UI first, then show success message
      onTrainingComplete?.(result.cafe_id);

      Alert.alert(
        "Training complete",
        `Model trained for ${result.cafe_name}\nItems: ${result.items.length}\nAccuracy: ${(result.r2 * 100).toFixed(1)}%`,
      );
    } catch (error: unknown) {
      Alert.alert("Training Failed", String(error));
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  const editableMapping = assessment?.editable_mapping || [];
  const confidenceStyle = assessment
    ? getConfidenceStyle(assessment.confidence)
    : null;

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Brain size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Train AI model</Text>
          <Text style={styles.subtitle}>
            Upload sales data — our AI maps columns automatically
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  i <= currentStepIndex && styles.stepDotActive,
                ]}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 size={14} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepDotText,
                      i <= currentStepIndex && styles.stepDotTextActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  i <= currentStepIndex && styles.stepLabelActive,
                ]}
              >
                {s.label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  i < currentStepIndex && styles.stepLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step 1: Upload */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Upload your data</Text>
        <Text style={styles.cardDesc}>
          Select a CSV file with your historical sales. Any column format works.
        </Text>

        <Text style={styles.fieldLabel}>Cafe name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bean & Brew Cafe"
          value={cafeName}
          onChangeText={setCafeName}
          placeholderTextColor={colors.textSoft}
        />

        <TouchableOpacity
          style={[styles.uploadZone, file && styles.uploadZoneFilled]}
          onPress={pickFile}
          activeOpacity={0.85}
        >
          {file ? (
            <>
              <FileSpreadsheet size={28} color={colors.primary} />
              <Text style={styles.uploadFileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.uploadChange}>Tap to change file</Text>
            </>
          ) : (
            <>
              <Upload size={28} color={colors.textSoft} />
              <Text style={styles.uploadPrompt}>Tap to select CSV file</Text>
              <Text style={styles.uploadHint}>Supports .csv format</Text>
            </>
          )}
        </TouchableOpacity>

        {file && (
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAssess}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading && step === "assessing" ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Sparkles size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>Analyze with AI</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Assessment */}
      {assessment && confidenceStyle && (
        <View
          style={[
            styles.card,
            { borderColor: confidenceStyle.border, borderWidth: 1.5 },
          ]}
        >
          <Text style={styles.cardTitle}>2. Review AI mapping</Text>

          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: confidenceStyle.bg },
            ]}
          >
            <Text style={[styles.confidenceText, { color: confidenceStyle.text }]}>
              {assessment.confidence.toUpperCase()} confidence
            </Text>
          </View>

          {assessment.ai_engine && (
            <View style={styles.engineBadge}>
              <Zap size={14} color={colors.primary} />
              <Text style={styles.engineText}>
                {assessment.ai_engine === "ollama"
                  ? "Ollama (local AI)"
                  : "Rule-based mapping"}
              </Text>
            </View>
          )}

          <View style={styles.layerCard}>
            <Text style={styles.layerTitle}>How columns were mapped</Text>
            <View style={styles.layerRow}>
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown?.rule_based_mapped || 0}
                </Text>
                <Text style={styles.layerLabel}>Rules</Text>
              </View>
              <View style={styles.layerDivider} />
              <View style={styles.layerItem}>
                <Text style={styles.layerNumber}>
                  {assessment.layer_breakdown?.llm_mapped || 0}
                </Text>
                <Text style={styles.layerLabel}>AI</Text>
              </View>
              <View style={styles.layerDivider} />
              <View style={styles.layerItem}>
                <Text style={[styles.layerNumber, { color: colors.error }]}>
                  {assessment.layer_breakdown?.needs_confirmation || 0}
                </Text>
                <Text style={styles.layerLabel}>Review</Text>
              </View>
            </View>
            {assessment.diagnostic ? (
              <Text style={styles.diagnosticText}>{assessment.diagnostic}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Column mappings</Text>
          <Text style={styles.editHint}>Tap a chip to change the mapping</Text>

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
                  entry.source === "llm" && styles.mappingCardLlm,
                  entry.source === "unmapped" && styles.mappingCardUnmapped,
                  isModified && styles.mappingCardModified,
                ]}
              >
                <View style={styles.mappingHeader}>
                  <Text style={styles.mappingColumn}>{entry.original_column}</Text>
                  <View style={styles.sourcePill}>
                    <Text style={styles.sourcePillText}>
                      {entry.source === "llm"
                        ? "AI"
                        : entry.source === "rule"
                          ? "Rule"
                          : "Manual"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.mappingMapsTo}>
                  Maps to{" "}
                  <Text style={styles.mappingValue}>{currentValue}</Text>
                  {isModified ? (
                    <Text style={styles.modifiedTag}> · edited</Text>
                  ) : null}
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
                          currentValue === option && styles.optionChipTextSelected,
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

          {(assessment.data_quality_issues || []).length > 0 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Data quality issues</Text>
              {(assessment.data_quality_issues || []).map((issue, i) => (
                <Text key={i} style={styles.alertItem}>
                  · {issue}
                </Text>
              ))}
            </View>
          )}

          {(assessment.suggestions || []).length > 0 && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Suggestions</Text>
              {(assessment.suggestions || []).map((s, i) => (
                <Text key={i} style={styles.tipItem}>
                  · {s}
                </Text>
              ))}
            </View>
          )}

          {(assessment.missing_required || []).length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Missing required: {(assessment.missing_required || []).join(", ")}
              </Text>
              <Text style={styles.warningSub}>
                Map these columns above before training.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !assessment.usable && styles.btnDisabled,
              loading && styles.btnDisabled,
            ]}
            onPress={handleTrain}
            disabled={!assessment.usable || loading}
            activeOpacity={0.88}
          >
            {loading && step === "training" ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <ChevronRight size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>
                  {assessment.usable ? "Train model" : "Fix mappings to train"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Step 3: Done */}
      {trainingResult && (
        <View style={[styles.card, styles.successCard]}>
          <View style={styles.successHeader}>
            <View style={styles.successIconWrap}>
              <CheckCircle2 size={28} color={colors.success} />
            </View>
            <View>
              <Text style={styles.successTitle}>Model ready!</Text>
              <Text style={styles.successSubtitle}>
                {trainingResult.cafe_name}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{trainingResult.rows_used}</Text>
              <Text style={styles.statLabel}>Rows trained</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{trainingResult.items.length}</Text>
              <Text style={styles.statLabel}>Menu items</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {(trainingResult.r2 * 100).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Detected menu items</Text>
          <View style={styles.itemsWrap}>
            {trainingResult.items.map((item) => (
              <View key={item} style={styles.itemChip}>
                <Text style={styles.itemChipText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.readyNote}>
            You can now run predictions on your dashboard below.
          </Text>
        </View>
      )}

      {loading && step !== "assessing" && step !== "training" && (
        <ActivityIndicator
          style={{ marginTop: spacing.md }}
          color={colors.primary}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.md,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    alignItems: "center",
    gap: 4,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSoft,
  },
  stepDotTextActive: {
    color: colors.white,
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 6,
    marginBottom: 18,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  successCard: {
    borderColor: "rgba(143, 151, 121, 0.3)",
    backgroundColor: colors.successSoft,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  uploadZoneFilled: {
    borderColor: colors.primary,
    borderStyle: "solid",
    backgroundColor: colors.primarySoft,
  },
  uploadPrompt: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  uploadHint: {
    fontSize: 12,
    color: colors.textSoft,
  },
  uploadFileName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    maxWidth: "90%",
  },
  uploadChange: {
    fontSize: 12,
    color: colors.textSoft,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  confidenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  engineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  engineText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  layerCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  layerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  layerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  layerItem: {
    flex: 1,
    alignItems: "center",
  },
  layerDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  layerNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 2,
  },
  layerLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
  },
  diagnosticText: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.sm,
    lineHeight: 18,
    fontStyle: "italic",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editHint: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  mappingCard: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  mappingCardLlm: {
    borderLeftColor: "#9B59B6",
    backgroundColor: "#faf5ff",
  },
  mappingCardUnmapped: {
    borderLeftColor: "#f59e0b",
    backgroundColor: "#fffbeb",
  },
  mappingCardModified: {
    borderLeftColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  mappingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  mappingColumn: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  sourcePill: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSoft,
  },
  mappingMapsTo: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  mappingValue: {
    fontWeight: "700",
    color: colors.text,
  },
  modifiedTag: {
    color: colors.success,
    fontWeight: "600",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
  },
  optionChipTextSelected: {
    color: colors.white,
    fontWeight: "700",
  },
  alertBox: {
    backgroundColor: colors.errorSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
    marginBottom: 4,
  },
  alertItem: {
    fontSize: 12,
    color: colors.error,
    lineHeight: 18,
  },
  tipBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 4,
  },
  tipItem: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: colors.errorSoft,
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  warningText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },
  warningSub: {
    fontSize: 11,
    color: colors.error,
    marginTop: 4,
  },
  successHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  successIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textSoft,
    marginTop: 2,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSoft,
    fontWeight: "600",
    textAlign: "center",
  },
  itemsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.md,
  },
  itemChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 151, 121, 0.3)",
  },
  itemChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  readyNote: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
