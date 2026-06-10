import { classifyFoodImage, CLASSIFY_FOOD_URL } from "@/src/ai/api";
import { Text, TextInput } from "@/src/components/StyledText";
import { FormSubmitError, FieldError } from "@/src/components/FieldError";
import {
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import {
  foodLabelToItemName,
  formatFoodLabel,
} from "@/src/utils/foodClassification";
import { ExpiryPickerFields } from "@/src/components/dashboard/ExpiryPickerFields";
import * as ImagePicker from "expo-image-picker";
import { uploadImageFromUri } from "@/src/services/firebase/storageUpload";
import { computeInitialListingAnchor } from "@/src/services/pricing/dynamicPricing";
import {
  combineExpiryAt,
  formatIsoDate,
  hoursUntilExpiry,
} from "@/src/utils/inventoryFormUtils";
import {
  ChevronDown,
  DollarSign,
  Package,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  onSuccess?: () => void;
}

const CATEGORIES: { label: string; value: ItemCategory }[] = [
  { label: "Bakery", value: "Bakery" },
  { label: "Pastries", value: "Pastries" },
  { label: "Bread", value: "Bread" },
  { label: "Desserts", value: "Desserts" },
  { label: "Meals", value: "Meals" },
  { label: "Beverages", value: "Beverages" },
  { label: "Other", value: "Other" },
];

export function AddItemModal({
  open,
  onOpenChange,
  sellerId,
  onSuccess,
}: AddItemModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ItemCategory>("Bakery");
  const [quantity, setQuantity] = useState("1");
  const [retailPrice, setRetailPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [useSmartPricing, setUseSmartPricing] = useState(false);
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [expiryTime, setExpiryTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [classificationConfidence, setClassificationConfidence] = useState<
    number | null
  >(null);
  const [classificationNotice, setClassificationNotice] = useState<
    string | null
  >(null);
  const [nameSuggestion, setNameSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  /** Bumps on each new photo so slower classify responses cannot overwrite a newer pick. */
  const classifyGenerationRef = useRef(0);

  const expiryAt = useMemo(
    () => combineExpiryAt(expiryDate, expiryTime),
    [expiryDate, expiryTime],
  );

  const autoSalePreview = useMemo(() => {
    const retail = parseFloat(retailPrice);
    if (!useSmartPricing || !Number.isFinite(retail) || retail <= 0) return null;
    return computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt));
  }, [retailPrice, useSmartPricing, expiryAt]);

  const resetForm = () => {
    classifyGenerationRef.current += 1;
    setName("");
    setCategory("Bakery");
    setQuantity("1");
    setRetailPrice("");
    setSalePrice("");
    setUseSmartPricing(false);
    setExpiryDate(new Date());
    setExpiryTime(new Date());
    setImageUri(null);
    setClassifying(false);
    setAiSuggested(false);
    setClassificationConfidence(null);
    setClassificationNotice(null);
    setNameSuggestion(null);
    setErrors({});
  };

  const clearAiSuggestionFields = () => {
    setName("");
    setCategory("Bakery");
    setAiSuggested(false);
    setClassificationConfidence(null);
    setNameSuggestion(null);
    setClassificationNotice(null);
  };

  const runFoodClassification = async (uri: string) => {
    const generation = ++classifyGenerationRef.current;

    setClassifying(true);
    clearAiSuggestionFields();

    try {
      const { foodLabel, category: predictedCategory, confidence } =
        await classifyFoodImage(uri);

      if (generation !== classifyGenerationRef.current) {
        return;
      }

      setCategory(predictedCategory);

      const itemName = foodLabelToItemName(foodLabel, predictedCategory);
      if (itemName) {
        setName(itemName);
        setErrors((prev) => clearFieldError(prev, "name"));
        setNameSuggestion(null);
      } else if (foodLabel.trim()) {
        setName("");
        setNameSuggestion(formatFoodLabel(foodLabel));
      } else {
        setName("");
        setNameSuggestion(null);
      }

      setAiSuggested(true);
      setClassificationConfidence(confidence);
    } catch (error) {
      if (generation !== classifyGenerationRef.current) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Detection failed";
      console.error("classify-food failed", { url: CLASSIFY_FOOD_URL, error });
      Alert.alert(
        "Detection failed",
        `${message}\n\nServer: ${CLASSIFY_FOOD_URL}\n(Generic ImageNet labels — edit name and category before publishing.)`,
      );
      setClassificationNotice(
        "Could not detect name or category — please enter manually.",
      );
    } finally {
      if (generation === classifyGenerationRef.current) {
        setClassifying(false);
      }
    }
  };

  const applyPickedImage = (uri: string) => {
    setImageUri(uri);
    setErrors((prev) => clearFieldError(prev, "image"));
    void runFoodClassification(uri);
  };

  const validateForm = (): boolean => {
    const next: FormErrors = {};
    if (!imageUri) next.image = "Please add a photo for this item";
    if (!name.trim()) next.name = "Please enter item name";
    if (!quantity || parseInt(quantity, 10) <= 0)
      next.quantity = "Please enter valid quantity";

    const retail = parseFloat(retailPrice);
    if (!Number.isFinite(retail) || retail <= 0)
      next.retailPrice = "Please enter a valid retail value";

    if (!useSmartPricing) {
      const sale = parseFloat(salePrice);
      if (!Number.isFinite(sale) || sale <= 0)
        next.salePrice = "Please enter a valid sale price";
      else if (sale >= retail)
        next.salePrice = "Sale price must be less than retail value";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onDateChange = (event: { type?: string }, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate && event.type !== "dismissed") setExpiryDate(selectedDate);
  };

  const onTimeChange = (event: { type?: string }, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime && event.type !== "dismissed") setExpiryTime(selectedTime);
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera roll permissions");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      applyPickedImage(result.assets[0].uri);
    }
  };

  const pickImageFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera permissions");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      applyPickedImage(result.assets[0].uri);
    }
  };

  const pickImage = () => {
    Alert.alert("Item photo", "Choose a source", [
      { text: "Camera", onPress: () => void pickImageFromCamera() },
      { text: "Gallery", onPress: () => void pickImageFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!imageUri) return;

    const retail = parseFloat(retailPrice);
    setLoading(true);
    try {
      const imageUrl = await uploadImageFromUri(
        imageUri,
        `sellers/${sellerId}/inventory/${Date.now()}.jpg`,
      );

      const listFloor = useSmartPricing
        ? computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt))
        : parseFloat(salePrice);

      await inventoryService.addItem(sellerId, {
        name: name.trim(),
        category,
        quantity: parseInt(quantity, 10),
        price: listFloor,
        originalPrice: retail,
        discountedPrice: listFloor,
        smartPricingEnabled: useSmartPricing,
        expiryDate: formatIsoDate(expiryDate),
        expiryAt,
        imageUrl,
        aiDetected: aiSuggested,
        classificationConfidence:
          aiSuggested && classificationConfidence != null
            ? classificationConfidence
            : undefined,
      });

      Alert.alert("Success", "Item added successfully!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error adding item:", error);
      const message =
        error instanceof Error ? error.message : "Failed to add item";
      setErrors({
        submit:
          message.includes("image") || message.includes("Image")
            ? "Could not upload photo. Check your connection and try again."
            : "Failed to add item. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent={true}
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Package size={24} color={colors.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Add surplus item</Text>
              <Text style={styles.subtitle}>
                List a single product — optional smart pricing
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onOpenChange(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormSubmitError message={errors.submit} />

            {/* Image upload — pick first to auto-fill name & category */}
            <View style={styles.field}>
              <Text style={styles.label}>Item photo *</Text>
              <Text style={styles.fieldHint}>
                Photo is saved with your listing and used for AI name/category
                suggestions
              </Text>
              <TouchableOpacity
                style={[
                  styles.uploadBox,
                  errors.image && styles.uploadBoxError,
                ]}
                onPress={pickImage}
                disabled={classifying}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.uploadedImage}
                  />
                ) : (
                  <>
                    <Upload size={32} color={colors.textSoft} />
                    <Text style={styles.uploadText}>Tap to add photo</Text>
                    <Text style={styles.uploadSubtext}>
                      Camera or gallery · PNG, JPG up to 10MB
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {classifying ? (
                <View style={styles.classifyingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.classifyingText}>
                    Detecting name and category…
                  </Text>
                </View>
              ) : null}
              <FieldError message={errors.image} />
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>
                  Item Name *
                </Text>
                {classifying ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>
              <TextInput
                style={[
                  styles.input,
                  errors.name && styles.inputError,
                  classifying && styles.inputDisabled,
                ]}
                placeholder={
                  classifying
                    ? "Detecting from photo…"
                    : nameSuggestion
                      ? `AI saw “${nameSuggestion}” — enter your menu name`
                      : "e.g., Almond Croissant"
                }
                value={name}
                editable={!classifying}
                onChangeText={(text) => {
                  setName(text);
                  setErrors((prev) => clearFieldError(prev, "name"));
                }}
                placeholderTextColor={colors.textSoft}
              />
              <FieldError message={errors.name} />
            </View>

            {/* Category Dropdown */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Category *</Text>
                {classifying ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>
              <Dropdown
                key={`category-${imageUri ?? "none"}-${category}`}
                style={[
                  styles.dropdown,
                  classifying && styles.dropdownDisabled,
                ]}
                disable={classifying}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                inputSearchStyle={styles.dropdownSearch}
                iconStyle={styles.dropdownIcon}
                data={CATEGORIES}
                search
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={
                  classifying ? "Detecting category…" : "Select category"
                }
                searchPlaceholder="Search..."
                value={category}
                onChange={(item) => {
                  setCategory(item.value);
                }}
                renderRightIcon={() =>
                  classifying ? null : (
                    <ChevronDown size={20} color={colors.textSoft} />
                  )
                }
              />
              {aiSuggested && !classifying ? (
                <Text style={styles.aiHint}>
                  Suggested by AI (generic names like croissant, cake) — rename
                  and pick the right category before you publish.
                  {classificationConfidence != null
                    ? ` (${Math.round(classificationConfidence * 100)}% confident)`
                    : ""}
                </Text>
              ) : null}
              {classificationNotice ? (
                <Text style={styles.classificationNotice}>
                  {classificationNotice}
                </Text>
              ) : null}
            </View>

            {/* Smart pricing */}
            <View style={styles.smartCard}>
              <View style={styles.smartRow}>
                <View style={styles.smartIconWrap}>
                  <Sparkles size={20} color={colors.primary} />
                </View>
                <View style={styles.smartTextWrap}>
                  <Text style={styles.smartTitle}>Smart auto-pricing</Text>
                  <Text style={styles.smartDesc}>
                    When on, buyer price adjusts from expiry, stock left, and
                    closing time. Off = fixed sale price you set.
                  </Text>
                </View>
                <Switch
                  value={useSmartPricing}
                  onValueChange={setUseSmartPricing}
                  trackColor={{ false: "#ccc", true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Quantity in stock *</Text>
              <TextInput
                style={[styles.input, errors.quantity && styles.inputError]}
                placeholder="1"
                value={quantity}
                onChangeText={(t) => {
                  setQuantity(t.replace(/[^0-9]/g, ""));
                  setErrors((prev) => clearFieldError(prev, "quantity"));
                }}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSoft}
              />
              <FieldError message={errors.quantity} />
            </View>

            {/* Retail & sale */}
            <View style={styles.row}>
              <View
                style={[styles.field, { flex: 1, marginRight: spacing.sm }]}
              >
                <View style={styles.labelRow}>
                  <Tag size={16} color={colors.text} />
                  <Text style={styles.label}>Retail value *</Text>
                </View>
                <View style={styles.priceInput}>
                  <Text style={styles.dollarSign}>RM</Text>
                  <TextInput
                    style={[
                      styles.priceInputField,
                      errors.retailPrice && styles.inputError,
                    ]}
                    placeholder="0.00"
                    value={retailPrice}
                    onChangeText={(t) => {
                      setRetailPrice(t.replace(/[^0-9.]/g, ""));
                      setErrors((prev) => clearFieldError(prev, "retailPrice"));
                    }}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                <FieldError message={errors.retailPrice} />
              </View>

              <View style={[styles.field, { flex: 1, marginLeft: spacing.sm }]}>
                <View style={styles.labelRow}>
                  <DollarSign size={16} color={colors.primary} />
                  <Text style={styles.label}>
                    {useSmartPricing ? "Opening sale (auto)" : "Sale price *"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priceInput,
                    useSmartPricing && styles.priceInputDisabled,
                    errors.salePrice && styles.inputError,
                  ]}
                >
                  <Text style={styles.dollarSign}>RM</Text>
                  <TextInput
                    style={styles.priceInputField}
                    placeholder={useSmartPricing ? "Auto" : "0.00"}
                    value={
                      useSmartPricing
                        ? autoSalePreview != null
                          ? String(autoSalePreview)
                          : "—"
                        : salePrice
                    }
                    onChangeText={(t) => {
                      setSalePrice(t.replace(/[^0-9.]/g, ""));
                      setErrors((prev) => clearFieldError(prev, "salePrice"));
                    }}
                    keyboardType="decimal-pad"
                    editable={!useSmartPricing}
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                {useSmartPricing ? (
                  <Text style={styles.fieldHint}>
                    Live price updates for buyers after you publish
                  </Text>
                ) : (
                  <FieldError message={errors.salePrice} />
                )}
              </View>
            </View>

            <ExpiryPickerFields
              expiryDate={expiryDate}
              expiryTime={expiryTime}
              showDatePicker={showDatePicker}
              showTimePicker={showTimePicker}
              onOpenDate={() => {
                setShowTimePicker(false);
                setShowDatePicker((v) => !v);
              }}
              onOpenTime={() => {
                setShowDatePicker(false);
                setShowTimePicker((v) => !v);
              }}
              onCloseDate={() => setShowDatePicker(false)}
              onCloseTime={() => setShowTimePicker(false)}
              onDateChange={onDateChange}
              onTimeChange={onTimeChange}
              disabled={loading}
            />

            {/* Tips */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Tips</Text>
                <Text style={styles.infoText}>
                  • Mystery bags are best for mixed surplus — use this form for
                  single SKUs
                </Text>
                <Text style={styles.infoText}>
                  • Smart pricing is off by default for items; turn on to skip
                  manual discount updates
                </Text>
                <Text style={styles.infoText}>
                  • Stock counts down when sold or bundled into bags
                </Text>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => onOpenChange(false)}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Add Item</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  closeButton: {
    padding: spacing.sm,
  },
  form: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    opacity: 0.65,
    backgroundColor: colors.backgroundSoft,
  },
  classifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  classifyingText: {
    fontSize: 13,
    color: colors.textSoft,
  },
  dropdown: {
    height: 50,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: colors.textSoft,
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: colors.text,
  },
  dropdownSearch: {
    height: 40,
    fontSize: 15,
  },
  dropdownIcon: {
    width: 20,
    height: 20,
  },
  row: {
    flexDirection: "row",
  },
  priceInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: spacing.md,
  },
  dollarSign: {
    fontSize: 15,
    color: colors.textSoft,
    marginRight: spacing.xs,
  },
  priceInputField: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingRight: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  uploadBoxError: {
    borderColor: colors.error,
  },
  uploadedImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  uploadText: {
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.sm,
  },
  uploadSubtext: {
    fontSize: 13,
    color: colors.textSoft,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  smartCard: {
    backgroundColor: "#FFFBF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.2)",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  smartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  smartIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  smartTextWrap: {
    flex: 1,
  },
  smartTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  smartDesc: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
    lineHeight: 17,
  },
  priceInputDisabled: {
    backgroundColor: colors.backgroundSoft,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
  },
  dropdownDisabled: {
    opacity: 0.65,
    backgroundColor: colors.backgroundSoft,
  },
  aiHint: {
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  classificationNotice: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
});
