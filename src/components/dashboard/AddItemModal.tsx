import { Text, TextInput } from "@/src/components/StyledText";
import {
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import { colors, spacing } from "@/src/theme/styles";
import { ExpiryPickerFields } from "@/src/components/dashboard/ExpiryPickerFields";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
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
import React, { useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(false);

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
    setName("");
    setCategory("Bakery");
    setQuantity("1");
    setRetailPrice("");
    setSalePrice("");
    setUseSmartPricing(false);
    setExpiryDate(new Date());
    setExpiryTime(new Date());
    setImageUri(null);
  };

  const onDateChange = (event: { type?: string }, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate && event.type !== "dismissed") setExpiryDate(selectedDate);
  };

  const onTimeChange = (event: { type?: string }, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime && event.type !== "dismissed") setExpiryTime(selectedTime);
  };

  const pickImage = async () => {
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
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storage = getStorage();
    const filename = `inventory/${sellerId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter item name");
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      Alert.alert("Error", "Please enter valid quantity");
      return;
    }

    const retail = parseFloat(retailPrice);
    if (!Number.isFinite(retail) || retail <= 0) {
      Alert.alert("Error", "Please enter a valid retail value");
      return;
    }

    if (!useSmartPricing) {
      const sale = parseFloat(salePrice);
      if (!Number.isFinite(sale) || sale <= 0) {
        Alert.alert("Error", "Please enter a valid sale price");
        return;
      }
      if (sale >= retail) {
        Alert.alert("Error", "Sale price must be less than retail value");
        return;
      }
    }

    setLoading(true);
    try {
      let imageUrl: string | undefined;

      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

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
      });

      Alert.alert("Success", "Item added successfully!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error adding item:", error);
      Alert.alert("Error", "Failed to add item. Please try again.");
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
            {/* Item Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Chocolate Croissant"
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.textSoft}
              />
            </View>

            {/* Category Dropdown */}
            <View style={styles.field}>
              <Text style={styles.label}>Category *</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                inputSearchStyle={styles.dropdownSearch}
                iconStyle={styles.dropdownIcon}
                data={CATEGORIES}
                search
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select category"
                searchPlaceholder="Search..."
                value={category}
                onChange={(item) => {
                  setCategory(item.value);
                }}
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

            {/* Quantity */}
            <View style={styles.field}>
              <Text style={styles.label}>Quantity in stock *</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={quantity}
                onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSoft}
              />
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
                    style={styles.priceInputField}
                    placeholder="0.00"
                    value={retailPrice}
                    onChangeText={(t) =>
                      setRetailPrice(t.replace(/[^0-9.]/g, ""))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
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
                    onChangeText={(t) =>
                      setSalePrice(t.replace(/[^0-9.]/g, ""))
                    }
                    keyboardType="decimal-pad"
                    editable={!useSmartPricing}
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
                {useSmartPricing ? (
                  <Text style={styles.fieldHint}>
                    Live price updates for buyers after you publish
                  </Text>
                ) : null}
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

            {/* Image Upload */}
            <View style={styles.field}>
              <Text style={styles.label}>Item Image (Optional)</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.uploadedImage}
                  />
                ) : (
                  <>
                    <Upload size={32} color={colors.textSoft} />
                    <Text style={styles.uploadText}>Click to upload image</Text>
                    <Text style={styles.uploadSubtext}>PNG, JPG up to 5MB</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

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
});
