import { Text } from "@/src/components/StyledText";
import { colors } from "@/src/theme/styles";
import { StyleSheet, View } from "react-native";

/** Red helper text shown directly below an input. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

/** Form-level error (e.g. login failed, submit failed). */
export function FormSubmitError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.submitWrap}>
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

export const inputErrorBorder = {
  borderColor: colors.error,
} as const;

const styles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  submitWrap: {
    marginBottom: 16,
  },
});
