import { Text, TextInput } from "@/src/components/StyledText";
import {
  inventoryService,
  ItemCategory,
} from "@/src/services/firebase/inventoryServices";
import { colors, spacing } from "@/src/theme/styles";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import {
  Calendar,
  ChevronDown,
  Clock,
  Package,
  Upload,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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
  const [price, setPrice] = useState("0.00");
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [expiryTime, setExpiryTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setCategory("Bakery");
    setQuantity("1");
    setPrice("0.00");
    setExpiryDate(new Date());
    setExpiryTime(new Date());
    setImageUri(null);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const formatDateForFirebase = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTimeForFirebase = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = "00";
    return `${hours}:${minutes}:${seconds}`;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate && event.type !== "dismissed") {
      setExpiryDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedTime && event.type !== "dismissed") {
      setExpiryTime(selectedTime);
    }
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

    if (!price || parseFloat(price) <= 0) {
      Alert.alert("Error", "Please enter valid price");
      return;
    }

    setLoading(true);
    try {
      let imageUrl: string | undefined;

      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      await inventoryService.addItem(sellerId, {
        name: name.trim(),
        category,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        expiryDate: formatDateForFirebase(expiryDate),
        expiryTime: formatTimeForFirebase(expiryTime),
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
              <Text style={styles.title}>Add Inventory Item</Text>
              <Text style={styles.subtitle}>Add new items to your stock</Text>
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

            {/* Quantity and Price */}
            <View style={styles.row}>
              <View
                style={[styles.field, { flex: 1, marginRight: spacing.sm }]}
              >
                <Text style={styles.label}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSoft}
                />
              </View>

              <View style={[styles.field, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>Original Price *</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.dollarSign}>RM</Text>
                  <TextInput
                    style={styles.priceInputField}
                    placeholder="0.00"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSoft}
                  />
                </View>
              </View>
            </View>

            {/* Expiry Date and Time */}
            <View style={styles.row}>
              <View
                style={[styles.field, { flex: 1, marginRight: spacing.sm }]}
              >
                <Text style={styles.label}>Expiry Date *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={18} color={colors.textSoft} />
                  <Text style={styles.dateTimeText}>
                    {formatDate(expiryDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.field, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>Expiry Time *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Clock size={18} color={colors.textSoft} />
                  <Text style={styles.dateTimeText}>
                    {formatTime(expiryTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>📦</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Auto-Management Features:</Text>
                <Text style={styles.infoText}>
                  • Stock automatically updates when used in mystery bags
                </Text>
                <Text style={styles.infoText}>
                  • Items auto-expire based on date & time
                </Text>
                <Text style={styles.infoText}>
                  • Low stock alerts when quantity drops below 5
                </Text>
                <Text style={styles.infoText}>
                  • Expired items removed from active inventory
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

        {/* Date Picker Modal - Only shows when clicked */}
        {showDatePicker && (
          <Modal transparent visible={showDatePicker} animationType="fade">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Expiry Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  style={styles.picker}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.pickerDoneButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        )}

        {/* Time Picker Modal - Only shows when clicked */}
        {showTimePicker && (
          <Modal transparent visible={showTimePicker} animationType="fade">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Expiry Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={expiryTime}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onTimeChange}
                  style={styles.picker}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.pickerDoneButton}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        )}
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
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    backgroundColor: colors.white,
  },
  dateTimeText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    width: "85%",
    maxWidth: 400,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  picker: {
    width: "100%",
  },
  pickerDoneButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.md,
  },
  pickerDoneText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
