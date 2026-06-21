import { Text, TextInput } from "@/src/components/StyledText";
import { colors, spacing } from "@/src/theme/styles";
import * as DocumentPicker from "expo-document-picker";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileSpreadsheet,
  Upload,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { assessDataset, trainModel, updateAssessment } from "../../ai/api";
import { getAiErrorMessage } from "../../ai/errors";
import { DatasetAssessment, TrainingResult } from "../../ai/types";

interface UploadAndTrainScreenProps {
  onTrainingComplete?: (cafeId: string) => void;
}

const STEPS = [
  { key: "upload", label: "Your file" },
  { key: "review", label: "Quick check" },
  { key: "done", label: "All set" },
] as const;

const SETUP_GUIDE = [
  {
    title: "Where do I get my sales file?",
    body: "From your cash register (POS), Excel spreadsheet, or any app that tracks daily sales. Look for Export, Reports, or Sales history.",
  },
  {
    title: "What format do I need?",
    body: "Save it as a .csv file (comma-separated). Most POS systems and Excel can export to CSV.",
  },
  {
    title: "What should be inside the file?",
    body: "At least: the date, product name, and how many you sold. How many you made each day helps too. More weeks of history = better suggestions.",
  },
  {
    title: "What happens after I upload?",
    body: "We read your file and learn your usual patterns. Then you can open Get suggestions and see how much to bake.",
  },
];

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  item: "Product name",
  sold_qty: "How many sold",
  produced_qty: "How many made",
  price: "Price",
  day_of_week: "Day of week",
  unknown: "Skip this column",
};

/** Must match the backend's standard fields (REQUIRED_CORE + OPTIONAL_FEATURES). */
const STANDARD_FIELD_OPTIONS = [
  "date",
  "item",
  "sold_qty",
  "produced_qty",
  "price",
  "day_of_week",
  "unknown",
];

const REQUIRED_FIELDS = ["date", "item", "sold_qty"];

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
  const [showColumnDetails, setShowColumnDetails] = useState(false);

  const currentStepIndex = getStepIndex(step);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/csv",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      if (result.assets?.length) {
        setFile(result.assets[0]);
        setStep("upload");
        setAssessment(null);
        setTrainingResult(null);
        setUserCorrections({});
        return;
      }

      Alert.alert("No file chosen", "Please pick your sales .csv file and try again.");
    } catch (error) {
      Alert.alert(
        "Could not open files",
        "Please try again. If it keeps failing, close and reopen the app.",
      );
    }
  };

  const handleAssess = async () => {
    if (!file) {
      Alert.alert("Choose a file first", "Pick your sales .csv file before continuing.");
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
      setShowColumnDetails(
        (result.layer_breakdown?.needs_confirmation || 0) > 0 ||
          (result.missing_required || []).length > 0,
      );
    } catch (error: unknown) {
      const { title, message } = getAiErrorMessage(error, "assess");
      Alert.alert(title, message);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (column: string, standard: string) => {
    setUserCorrections((prev) => ({ ...prev, [column]: standard }));
  };

  // Usability based on the user's current (possibly edited) mappings,
  // so fixing a column in the UI immediately unlocks training.
  const mappedStandards = new Set(
    Object.values(userCorrections).filter((v) => v !== "unknown"),
  );
  const localMissingRequired = assessment
    ? REQUIRED_FIELDS.filter((f) => !mappedStandards.has(f))
    : [];
  const canTrain = !!assessment && localMissingRequired.length === 0;

  const handleTrain = async () => {
    if (!canTrain) {
      Alert.alert("File needs a fix", "Please check the column labels below, then try again.");
      return;
    }
    if (!assessment?.assessment_id || !file) {
      Alert.alert("Something went wrong", "Please upload your file again.");
      return;
    }

    try {
      setLoading(true);
      setStep("training");

      // Push any column-label edits to the backend first — /train reads the
      // mapping from the stored assessment, not from this screen.
      const mappingChanges: Record<string, string> = {};
      for (const entry of assessment.editable_mapping || []) {
        const chosen = userCorrections[entry.original_column];
        if (chosen && chosen !== entry.current_mapping) {
          mappingChanges[entry.original_column] = chosen;
        }
      }
      if (Object.keys(mappingChanges).length > 0) {
        const updated = await updateAssessment(
          assessment.assessment_id,
          mappingChanges,
        );
        if (!updated.usable) {
          Alert.alert(
            "File needs a fix",
            `Still needed: ${updated.missing_required.join(", ")}. Tap the labels to match what is in your file.`,
          );
          setStep("review");
          return;
        }
      }

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
        "You are all set!",
        `We saved your sales history for ${result.cafe_name}. You can now get bake suggestions for ${result.items.length} products.`,
      );
    } catch (error: unknown) {
      const { title, message } = getAiErrorMessage(error, "train");
      Alert.alert(title, message);
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
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <ClipboardList size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Set up your bake planner</Text>
          <Text style={styles.subtitle}>
            Upload your past sales so we can suggest how much to bake
          </Text>
        </View>
      </View>

      <View style={styles.guideCard}>
        <Text style={styles.guideCardTitle}>Step-by-step guide</Text>
        {SETUP_GUIDE.map((item, i) => (
          <View key={i} style={styles.guideItem}>
            <View style={styles.guideBullet}>
              <Text style={styles.guideBulletText}>{i + 1}</Text>
            </View>
            <View style={styles.guideItemText}>
              <Text style={styles.guideItemTitle}>{item.title}</Text>
              <Text style={styles.guideItemBody}>{item.body}</Text>
            </View>
          </View>
        ))}
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 5 — Upload your sales file</Text>
        <Text style={styles.cardDesc}>
          Choose the .csv file from your POS or spreadsheet. We will read it
          automatically.
        </Text>

        <Text style={styles.fieldLabel}>Shop name (optional)</Text>
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
              <Text style={styles.uploadChange}>Tap to choose a different file</Text>
            </>
          ) : (
            <>
              <Upload size={28} color={colors.textSoft} />
              <Text style={styles.uploadPrompt}>Tap to choose your sales file</Text>
              <Text style={styles.uploadHint}>.csv files only</Text>
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
                <ChevronRight size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>Check my file</Text>
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
          <Text style={styles.cardTitle}>Quick check</Text>
          <Text style={styles.cardDesc}>
            We found {assessment.total_rows} sales rows in your file
            {canTrain
              ? ". Everything looks ready — you can continue below."
              : ". A few column labels need your help before we continue."}
          </Text>

          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: confidenceStyle.bg },
            ]}
          >
            <Text style={[styles.confidenceText, { color: confidenceStyle.text }]}>
              {canTrain ? "READY TO GO" : "NEEDS A QUICK FIX"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowColumnDetails((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={styles.detailsToggleText}>
              {showColumnDetails
                ? "Hide how we read your columns"
                : "See how we read your columns"}
            </Text>
            {showColumnDetails ? (
              <ChevronUp size={16} color={colors.primary} />
            ) : (
              <ChevronDown size={16} color={colors.primary} />
            )}
          </TouchableOpacity>

          {showColumnDetails &&
            editableMapping.map((entry) => {
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
                <Text style={styles.mappingColumn}>
                  Your column: {entry.original_column}
                </Text>
                <Text style={styles.mappingMapsTo}>
                  We read this as{" "}
                  <Text style={styles.mappingValue}>
                    {COLUMN_LABELS[currentValue] || currentValue}
                  </Text>
                  {isModified ? (
                    <Text style={styles.modifiedTag}> · changed by you</Text>
                  ) : null}
                </Text>
                <View style={styles.optionsRow}>
                  {(entry.options || STANDARD_FIELD_OPTIONS).map((option) => (
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
                        {COLUMN_LABELS[option] || option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

          {(assessment.data_quality_issues || []).length > 0 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Please check your file</Text>
              {(assessment.data_quality_issues || []).map((issue, i) => (
                <Text key={i} style={styles.alertItem}>
                  · {issue}
                </Text>
              ))}
            </View>
          )}

          {(assessment.suggestions || []).length > 0 && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Helpful tips</Text>
              {(assessment.suggestions || []).map((s, i) => (
                <Text key={i} style={styles.tipItem}>
                  · {s}
                </Text>
              ))}
            </View>
          )}

          {localMissingRequired.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Still needed: {localMissingRequired.join(", ")}
              </Text>
              <Text style={styles.warningSub}>
                Tap the labels above to match what is in your file.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !canTrain && styles.btnDisabled,
              loading && styles.btnDisabled,
            ]}
            onPress={handleTrain}
            disabled={!canTrain || loading}
            activeOpacity={0.88}
          >
            {loading && step === "training" ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <ChevronRight size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>
                  {canTrain
                    ? "Save and get bake suggestions"
                    : "Fix columns first"}
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
              <Text style={styles.successTitle}>You are all set!</Text>
              <Text style={styles.successSubtitle}>
                {trainingResult.cafe_name}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{trainingResult.rows_used}</Text>
              <Text style={styles.statLabel}>Sales rows saved</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{trainingResult.items.length}</Text>
              <Text style={styles.statLabel}>Products found</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Products we found in your file</Text>
          <View style={styles.itemsWrap}>
            {trainingResult.items.map((item) => (
              <View key={item} style={styles.itemChip}>
                <Text style={styles.itemChipText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.statsFooter}>
            {(
              trainingResult.accuracy_pct ??
              Math.max(0, trainingResult.r2) * 100
            ).toFixed(1)}
            % accuracy · based on {trainingResult.rows_used} sales rows
          </Text>

          <Text style={styles.readyNote}>
            Scroll down to Get suggestions and see how much to bake.
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
  guideCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guideItem: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  guideBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  guideBulletText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  guideItemText: {
    flex: 1,
  },
  guideItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  guideItemBody: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
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
  statsFooter: {
    fontSize: 11,
    color: colors.textSoft,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  readyNote: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
