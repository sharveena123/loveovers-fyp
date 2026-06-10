import { Text } from "@/src/components/StyledText";
import { FieldError } from "@/src/components/FieldError";
import { colors, spacing } from "@/src/theme/styles";
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  style?: ViewStyle;
}

/** Label + input slot + red error text (or optional helper) below. */
export function FormField({
  label,
  error,
  helperText,
  required,
  children,
  style,
}: FormFieldProps) {
  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      {children}
      {error ? (
        <FieldError message={error} />
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  helper: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
    lineHeight: 16,
  },
});
