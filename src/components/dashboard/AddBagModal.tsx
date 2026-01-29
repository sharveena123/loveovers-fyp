import { Text, TextInput } from "@/src/components/StyledText";
import {
  InventoryItem,
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import { colors } from "@/src/theme/styles";
import {
  Calendar,
  Clock,
  DollarSign,
  Package,
  Tag,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface AddBagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  quantity: string;
  category: ItemCategory;
  originalPrice: string;
  salePrice: string;
  pickupStartTime: string;
  pickupEndTime: string;
  expiryDate: string;
  expiryTime: string;
  itemsIncluded: string;
  status: "fresh" | "expiring" | "expired";
}

export function AddBagModal({
  open,
  onOpenChange,
  sellerId,
  onSuccess,
}: AddBagModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    quantity: "",
    category: "Bakery",
    originalPrice: "",
    salePrice: "",
    pickupStartTime: "",
    pickupEndTime: "",
    expiryDate: "",
    expiryTime: "",
    itemsIncluded: "",
    status: "fresh",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories: ItemCategory[] = [
    "Bakery",
    "Meals",
    "Pastries",
    "Bread",
    "Desserts",
    "Beverages",
    "Other",
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Bag name is required";
    if (!formData.originalPrice || parseFloat(formData.originalPrice) <= 0)
      newErrors.originalPrice = "Original price must be greater than 0";
    if (!formData.salePrice || parseFloat(formData.salePrice) <= 0)
      newErrors.salePrice = "Sale price must be greater than 0";
    if (
      formData.originalPrice &&
      formData.salePrice &&
      parseFloat(formData.salePrice) >= parseFloat(formData.originalPrice)
    )
      newErrors.salePrice = "Sale price must be less than original price";
    if (!formData.quantity || parseInt(formData.quantity) <= 0)
      newErrors.quantity = "Quantity must be greater than 0";
    if (!formData.pickupStartTime)
      newErrors.pickupStartTime = "Start time is required";
    if (!formData.pickupEndTime)
      newErrors.pickupEndTime = "End time is required";
    if (!formData.expiryDate) newErrors.expiryDate = "Expiry date is required";
    if (!formData.expiryTime) newErrors.expiryTime = "Expiry time is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const itemData: Omit<InventoryItem, "id" | "createdAt" | "updatedAt"> = {
        sellerId,
        name: formData.name.trim(),
        type: "bag", // Add this line - it was missing!
        price: parseFloat(formData.salePrice),
        quantity: parseInt(formData.quantity),
        category: formData.category,
        originalPrice: parseFloat(formData.originalPrice),
        discountedPrice: parseFloat(formData.salePrice),
        expiryDate: `${formData.expiryDate}, ${formData.expiryTime}`,
        status: formData.status,
        description: formData.itemsIncluded.trim() || undefined,
      };

      await inventoryService.addInventoryItem(sellerId, itemData);

      setFormData({
        name: "",
        quantity: "",
        category: "Bakery",
        originalPrice: "",
        salePrice: "",
        pickupStartTime: "",
        pickupEndTime: "",
        expiryDate: "",
        expiryTime: "",
        itemsIncluded: "",
        status: "fresh",
      });
      setErrors({});

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
      setFormData({
        name: "",
        quantity: "",
        category: "Bakery",
        originalPrice: "",
        salePrice: "",
        pickupStartTime: "",
        pickupEndTime: "",
        expiryDate: "",
        expiryTime: "",
        itemsIncluded: "",
        status: "fresh",
      });
      setErrors({});
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
            <Text style={styles.title}>Create Mystery Bag</Text>
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
                <Text style={styles.label}>Bag Name</Text>
              </View>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Mystery Bag"
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

            {/* Original Price & Sale Price */}
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <View style={styles.labelRow}>
                  <Tag size={18} color={colors.text} />
                  <Text style={styles.label}>Original Price</Text>
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
                  <Text style={styles.label}>Sale Price</Text>
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>RM</Text>
                  <TextInput
                    style={[
                      styles.priceInput,
                      errors.salePrice && styles.inputError,
                    ]}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={formData.salePrice}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        salePrice: text.replace(/[^0-9.]/g, ""),
                      })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                {errors.salePrice && (
                  <Text style={styles.errorTextSmall}>{errors.salePrice}</Text>
                )}
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

            {/* Pickup Time Window */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Clock size={18} color="#000" />
                <Text style={styles.label}>Pickup Time Window</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.pickupStartTime && styles.inputError,
                    ]}
                    placeholder="--:-- --"
                    value={formData.pickupStartTime}
                    onChangeText={(text) =>
                      setFormData({ ...formData, pickupStartTime: text })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                  <Text style={styles.hint}>Start time</Text>
                  {errors.pickupStartTime && (
                    <Text style={styles.errorTextSmall}>
                      {errors.pickupStartTime}
                    </Text>
                  )}
                </View>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.pickupEndTime && styles.inputError,
                    ]}
                    placeholder="--:-- --"
                    value={formData.pickupEndTime}
                    onChangeText={(text) =>
                      setFormData({ ...formData, pickupEndTime: text })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                  <Text style={styles.hint}>End time</Text>
                  {errors.pickupEndTime && (
                    <Text style={styles.errorTextSmall}>
                      {errors.pickupEndTime}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Expiry Date & Time */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Calendar size={18} color="#DC2626" />
                <Text style={styles.label}>Expiry Date & Time</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.expiryDate && styles.inputError,
                    ]}
                    placeholder="dd/mm/yyyy"
                    value={formData.expiryDate}
                    onChangeText={(text) =>
                      setFormData({ ...formData, expiryDate: text })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                  {errors.expiryDate && (
                    <Text style={styles.errorTextSmall}>
                      {errors.expiryDate}
                    </Text>
                  )}
                </View>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.expiryTime && styles.inputError,
                    ]}
                    placeholder="--:-- --"
                    value={formData.expiryTime}
                    onChangeText={(text) =>
                      setFormData({ ...formData, expiryTime: text })
                    }
                    editable={!loading}
                    placeholderTextColor={colors.textSoft}
                  />
                  {errors.expiryTime && (
                    <Text style={styles.errorTextSmall}>
                      {errors.expiryTime}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.hint}>When do these items expire?</Text>
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
                • Set competitive prices (typically 50-70% off)
              </Text>
              <Text style={styles.proTip}>
                • Choose realistic pickup windows
              </Text>
              <Text style={styles.proTip}>• Be clear about expiry times</Text>
              <Text style={styles.proTip}>
                • Update quantity as bags sell out
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
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
