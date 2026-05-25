import { Text, TextInput } from "@/src/components/StyledText";
import {
  InventoryItem,
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import { computeInitialListingAnchor } from "@/src/services/pricing/dynamicPricing";
import { colors, spacing } from "@/src/theme/styles";
import {
  combineExpiryAt,
  formatIsoDate,
  hoursUntilExpiry,
} from "@/src/utils/inventoryFormUtils";
import { ExpiryPickerFields } from "@/src/components/dashboard/ExpiryPickerFields";
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
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

interface AddBagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  onSuccess: () => void;
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

interface FormData {
  name: string;
  quantity: string;
  category: ItemCategory;
  originalPrice: string;
  salePrice: string;
  itemsIncluded: string;
}

export function AddBagModal({
  open,
  onOpenChange,
  sellerId,
  onSuccess,
}: AddBagModalProps) {
  const [loading, setLoading] = useState(false);
  const defaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
    return d;
  };

  const [formData, setFormData] = useState<FormData>({
    name: "",
    quantity: "",
    category: "Bakery",
    originalPrice: "",
    salePrice: "",
    itemsIncluded: "",
  });
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [expiryTime, setExpiryTime] = useState(defaultExpiry);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useSmartPricing, setUseSmartPricing] = useState(true);

  const expiryAt = useMemo(
    () => combineExpiryAt(expiryDate, expiryTime),
    [expiryDate, expiryTime],
  );

  const autoSalePreview = useMemo(() => {
    const retail = parseFloat(formData.originalPrice);
    if (!useSmartPricing || !Number.isFinite(retail) || retail <= 0) return null;
    return computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt));
  }, [formData.originalPrice, useSmartPricing, expiryAt]);

  const resetFields = () => {
    const exp = defaultExpiry();
    setFormData({
      name: "",
      quantity: "",
      category: "Bakery",
      originalPrice: "",
      salePrice: "",
      itemsIncluded: "",
    });
    setExpiryDate(exp);
    setExpiryTime(exp);
    setUseSmartPricing(true);
    setErrors({});
  };

  const onDateChange = (event: { type?: string }, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate && event.type !== "dismissed") setExpiryDate(selectedDate);
  };

  const onTimeChange = (event: { type?: string }, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime && event.type !== "dismissed") setExpiryTime(selectedTime);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Bag name is required";
    if (!formData.originalPrice || parseFloat(formData.originalPrice) <= 0)
      newErrors.originalPrice = "Original price must be greater than 0";
    if (
      !useSmartPricing &&
      (!formData.salePrice || parseFloat(formData.salePrice) <= 0)
    )
      newErrors.salePrice = "Sale price must be greater than 0";
    if (
      !useSmartPricing &&
      formData.originalPrice &&
      formData.salePrice &&
      parseFloat(formData.salePrice) >= parseFloat(formData.originalPrice)
    )
      newErrors.salePrice = "Sale price must be less than original price";
    if (!formData.quantity || parseInt(formData.quantity, 10) <= 0)
      newErrors.quantity = "Quantity must be greater than 0";
    if (expiryAt.getTime() <= Date.now())
      newErrors.expiry = "Expiry must be in the future";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const retail = parseFloat(formData.originalPrice);
      const isoDate = formatIsoDate(expiryDate);

      const salePriceNum = useSmartPricing
        ? computeInitialListingAnchor(retail, hoursUntilExpiry(expiryAt))
        : parseFloat(formData.salePrice);

      const itemData: Omit<InventoryItem, "id" | "createdAt" | "updatedAt"> = {
        sellerId,
        name: formData.name.trim(),
        type: "bag",
        price: salePriceNum,
        quantity: parseInt(formData.quantity, 10),
        category: formData.category,
        originalPrice: retail,
        discountedPrice: salePriceNum,
        smartPricingEnabled: useSmartPricing,
        expiryDate: isoDate,
        expiryTime: Timestamp.fromDate(expiryAt),
        status: "fresh",
        description: formData.itemsIncluded.trim() || undefined,
      };

      await inventoryService.addInventoryItem(sellerId, itemData);

      resetFields();

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding item:", error);
      setErrors({ submit: "Failed to add item. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetFields();
      onOpenChange(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <ShoppingBag size={24} color="#fff" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Create mystery bag</Text>
              <Text style={styles.subtitle}>
                Smart pricing on by default — no manual discounts
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              style={styles.closeButton}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {errors.submit && (
              <Text style={styles.errorText}>{errors.submit}</Text>
            )}

            {/* Bag Name */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Package size={18} color={colors.primary} />
                <Text style={styles.label}>Bag name *</Text>
              </View>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="e.g. Evening bakery surprise"
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                editable={!loading}
                placeholderTextColor={colors.textSoft}
              />
              {errors.name && (
                <Text style={styles.errorTextSmall}>{errors.name}</Text>
              )}
            </View>

            {/* Category */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Category *</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={CATEGORIES}
                maxHeight={280}
                labelField="label"
                valueField="value"
                placeholder="Select category"
                value={formData.category}
                onChange={(item) =>
                  setFormData({ ...formData, category: item.value })
                }
                renderRightIcon={() => (
                  <ChevronDown size={20} color={colors.textSoft} />
                )}
              />
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
                    List price updates for buyers from expiry, stock left, and
                    closing-time demand — no manual discount math.
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

            {/* Original Price & Sale Price */}
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <View style={styles.labelRow}>
                  <Tag size={18} color={colors.text} />
                  <Text style={styles.label}>Retail value</Text>
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>RM</Text>
                  <TextInput
                    style={[
                      styles.priceInput,
                      errors.originalPrice && styles.inputError,
                    ]}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={formData.originalPrice}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        originalPrice: text.replace(/[^0-9.]/g, ""),
                      })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                {errors.originalPrice && (
                  <Text style={styles.errorTextSmall}>
                    {errors.originalPrice}
                  </Text>
                )}
              </View>

              <View style={styles.fieldHalf}>
                <View style={styles.labelRow}>
                  <DollarSign size={18} color={colors.primary} />
                  <Text style={styles.label}>
                    {useSmartPricing ? "Opening sale (auto)" : "Sale price"}
                  </Text>
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>RM</Text>
                  <TextInput
                    style={[
                      styles.priceInput,
                      errors.salePrice && styles.inputError,
                      useSmartPricing && styles.inputDisabled,
                    ]}
                    placeholder={useSmartPricing ? "Auto" : "0.00"}
                    keyboardType="decimal-pad"
                    value={
                      useSmartPricing
                        ? autoSalePreview != null
                          ? String(autoSalePreview)
                          : "—"
                        : formData.salePrice
                    }
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        salePrice: text.replace(/[^0-9.]/g, ""),
                      })
                    }
                    editable={!loading && !useSmartPricing}
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                {errors.salePrice && (
                  <Text style={styles.errorTextSmall}>{errors.salePrice}</Text>
                )}
                {useSmartPricing ? (
                  <Text style={styles.hint}>
                    Anchor updates live for shoppers from your retail value
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Quantity Available */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Package size={18} color={colors.success} />
                <Text style={styles.label}>Quantity Available</Text>
              </View>
              <TextInput
                style={[styles.input, errors.quantity && styles.inputError]}
                placeholder="How many bags?"
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    quantity: text.replace(/[^0-9]/g, ""),
                  })
                }
                editable={!loading}
                placeholderTextColor={colors.textSoft}
              />
              <Text style={styles.hint}>
                Number of mystery bags available for customers
              </Text>
              {errors.quantity && (
                <Text style={styles.errorTextSmall}>{errors.quantity}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
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
                error={errors.expiry}
                hint="Drives how aggressively smart pricing marks down this bag"
              />
            </View>

            {/* Items Included */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Items Included (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Croissants, bread, pastries, cookies..."
                value={formData.itemsIncluded}
                onChangeText={(text) =>
                  setFormData({ ...formData, itemsIncluded: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
                placeholderTextColor={colors.textSoft}
              />
              <Text style={styles.hint}>
                Give customers an idea of what might be included
              </Text>
            </View>

            {/* Pro Tips */}
            <View style={styles.proTipsContainer}>
              <Text style={styles.proTipsTitle}>💡 Pro Tips</Text>
              <Text style={styles.proTip}>
                • Smart pricing lowers the live sale price as expiry nears, stock
                is high, and closing time approaches
              </Text>
              <Text style={styles.proTip}>
                • Turn off smart pricing if you prefer a fixed sale price
              </Text>
              <Text style={styles.proTip}>
                • Set expiry to when food must be collected or discarded
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Create Mystery Bag</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: spacing.sm,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  dropdown: {
    height: 50,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: colors.textSoft,
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: colors.text,
  },
  form: {
    padding: 20,
    maxHeight: "80%",
  },
  fieldContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: "#F3F4F6",
    color: colors.textSoft,
  },
  smartCard: {
    backgroundColor: "#FFFBF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.2)",
    padding: 14,
    marginBottom: 16,
  },
  smartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  smartIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(106,60,0,0.12)",
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
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    fontSize: 15,
    borderWidth: 0,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 13,
    color: colors.textSoft,
    marginTop: 4,
  },
  proTipsContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  proTipsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  proTip: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  errorTextSmall: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
