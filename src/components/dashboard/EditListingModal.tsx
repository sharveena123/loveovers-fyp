import { Text, TextInput } from "@/src/components/StyledText";
import { FieldError, FormSubmitError } from "@/src/components/FieldError";
import { ExpiryPickerFields } from "@/src/components/dashboard/ExpiryPickerFields";
import {
  InventoryItem,
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import {
  computeInitialListingAnchor,
  resolveExpiryDate,
} from "@/src/services/pricing/dynamicPricing";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import {
  combineExpiryAt,
  formatIsoDate,
  hoursUntilExpiry,
} from "@/src/utils/inventoryFormUtils";
import { Timestamp } from "firebase/firestore";
import {
  ChevronDown,
  DollarSign,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

interface EditListingModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  sellerId: string;
  onSaved?: () => void;
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

export function EditListingModal({
  item,
  onClose,
  sellerId,
  onSaved,
}: EditListingModalProps) {
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const isBag = item?.type === "bag";
  const sold = item?.sold || 0;

  // Re-seed the form each time a listing is opened for editing.
  useEffect(() => {
    if (!item) return;
    setName(item.name || "");
    setCategory(item.category || "Other");
    setQuantity(String(item.quantity ?? 1));
    setRetailPrice(
      item.originalPrice != null ? String(item.originalPrice) : "",
    );
    setSalePrice(
      String(item.discountedPrice ?? item.price ?? ""),
    );
    setUseSmartPricing(item.smartPricingEnabled === true);
    const expiry = resolveExpiryDate(item) ?? new Date();
    setExpiryDate(new Date(expiry));
    setExpiryTime(new Date(expiry));
    setShowDatePicker(false);
    setShowTimePicker(false);
    setErrors({});
  }, [item]);

  const expiryAt = useMemo(
    () => combineExpiryAt(expiryDate, expiryTime),
    [expiryDate, expiryTime],
  );

  const autoSalePreview = useMemo(() => {
    const retail = parseFloat(retailPrice);
    if (!useSmartPricing || !Number.isFinite(retail) || retail <= 0) return null;
    return computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt));
  }, [retailPrice, useSmartPricing, expiryAt]);

  const validateForm = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Please enter a name";

    const qty = parseInt(quantity, 10);
    if (!quantity || !Number.isFinite(qty) || qty <= 0)
      next.quantity = "Please enter a valid quantity";
    else if (qty < sold)
      next.quantity = `Quantity can't be below ${sold} (already sold)`;

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

  const handleSave = async () => {
    if (!item?.id || !validateForm()) return;

    const retail = parseFloat(retailPrice);
    const listFloor = useSmartPricing
      ? computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt))
      : parseFloat(salePrice);

    setLoading(true);
    try {
      await inventoryService.updateItem(sellerId, item.id, {
        name: name.trim(),
        category,
        quantity: parseInt(quantity, 10),
        price: listFloor,
        originalPrice: retail,
        discountedPrice: listFloor,
        smartPricingEnabled: useSmartPricing,
        expiryDate: formatIsoDate(expiryDate),
        expiryTime: Timestamp.fromDate(expiryAt),
      });

      Alert.alert("Saved", "Listing updated successfully.");
      onClose();
      onSaved?.();
    } catch (error) {
      console.error("Error updating listing:", error);
      setErrors({ submit: "Failed to save changes. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={item != null}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {isBag ? (
                <ShoppingBag size={24} color={colors.white} />
              ) : (
                <Package size={24} color={colors.white} />
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {isBag ? "Edit mystery bag" : "Edit item"}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item?.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormSubmitError message={errors.submit} />

            <View style={styles.field}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder={isBag ? "e.g., Bakery Surprise Bag" : "e.g., Almond Croissant"}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setErrors((prev) => clearFieldError(prev, "name"));
                }}
                placeholderTextColor={colors.textSoft}
              />
              <FieldError message={errors.name} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Category *</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                iconStyle={styles.dropdownIcon}
                data={CATEGORIES}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select category"
                value={category}
                onChange={(option) => setCategory(option.value)}
                renderRightIcon={() => (
                  <ChevronDown size={20} color={colors.textSoft} />
                )}
              />
            </View>

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
              {sold > 0 && !errors.quantity ? (
                <Text style={styles.fieldHint}>
                  {sold} already sold — quantity can&apos;t go below that
                </Text>
              ) : null}
              <FieldError message={errors.quantity} />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: spacing.sm }]}>
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
                    Live price updates for buyers automatically
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

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Save changes</Text>
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  priceInputDisabled: {
    backgroundColor: colors.backgroundSoft,
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
  fieldHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
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
});
