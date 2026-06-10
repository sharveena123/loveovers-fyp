import { Text } from "@/src/components/StyledText";
import { FieldError } from "@/src/components/FieldError";
import { colors, spacing } from "@/src/theme/styles";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import React from "react";
import {
  Alert,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type ImageUploadFieldProps = {
  label: string;
  hint?: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  required?: boolean;
  error?: string;
};

export function ImageUploadField({
  label,
  hint,
  uri,
  onChange,
  required,
  error,
}: ImageUploadFieldProps) {
  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to upload.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TouchableOpacity
        style={[styles.box, error ? styles.boxError : null]}
        onPress={pick}
        activeOpacity={0.85}
      >
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity
              style={styles.remove}
              onPress={() => onChange(null)}
            >
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ImagePlus size={28} color={colors.textSoft} />
            <Text style={styles.placeholder}>Tap to upload photo</Text>
          </>
        )}
      </TouchableOpacity>
      <FieldError message={error} />
    </View>
  );
}

type MultiImageUploadFieldProps = {
  label: string;
  hint?: string;
  uris: string[];
  onChange: (uris: string[]) => void;
  max?: number;
  required?: boolean;
  error?: string;
};

export function MultiImageUploadField({
  label,
  hint,
  uris,
  onChange,
  max = 3,
  required,
  error,
}: MultiImageUploadFieldProps) {
  const pick = async () => {
    if (uris.length >= max) {
      Alert.alert("Limit reached", `You can upload up to ${max} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to upload.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled) {
      onChange([...uris, result.assets[0].uri]);
    }
  };

  const removeAt = (index: number) => {
    onChange(uris.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.multiRow}>
        {uris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <TouchableOpacity
              style={styles.thumbRemove}
              onPress={() => removeAt(index)}
            >
              <X size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        {uris.length < max ? (
          <TouchableOpacity style={styles.addThumb} onPress={pick}>
            <ImagePlus size={24} color={colors.primary} />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  box: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  boxError: {
    borderColor: colors.error,
  },
  image: {
    width: "100%",
    height: 160,
  },
  remove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    padding: 4,
  },
  placeholder: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSoft,
  },
  multiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  thumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    padding: 3,
  },
  addThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  addText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
});
