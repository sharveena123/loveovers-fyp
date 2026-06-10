import { Text } from "@/src/components/StyledText";
import { FieldError } from "@/src/components/FieldError";
import { colors, spacing } from "@/src/theme/styles";
import {
  formatDisplayDate,
  formatDisplayTime,
} from "@/src/utils/inventoryFormUtils";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar, Clock } from "lucide-react-native";
import React from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const IOS_PICKER_PROPS =
  Platform.OS === "ios"
    ? ({
        themeVariant: "light" as const,
        textColor: "#111111",
        accentColor: colors.primary,
      } as const)
    : {};

type ExpiryPickerFieldsProps = {
  expiryDate: Date;
  expiryTime: Date;
  showDatePicker: boolean;
  showTimePicker: boolean;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onCloseDate: () => void;
  onCloseTime: () => void;
  onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
  onTimeChange: (event: DateTimePickerEvent, date?: Date) => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
};

export function ExpiryPickerFields({
  expiryDate,
  expiryTime,
  showDatePicker,
  showTimePicker,
  onOpenDate,
  onOpenTime,
  onCloseDate,
  onCloseTime,
  onDateChange,
  onTimeChange,
  disabled,
  error,
  hint,
}: ExpiryPickerFieldsProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.previewBox}>
        <Text style={styles.previewLabel}>Selected expiry</Text>
        <Text style={styles.previewValue}>
          {formatDisplayDate(expiryDate)} · {formatDisplayTime(expiryTime)}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Expiry date *</Text>
          <TouchableOpacity
            style={[styles.dateBtn, error ? styles.dateBtnError : null]}
            onPress={onOpenDate}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Calendar size={18} color={colors.primary} />
            <Text style={styles.dateBtnText} numberOfLines={1}>
              {formatDisplayDate(expiryDate)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Expiry time *</Text>
          <TouchableOpacity
            style={[styles.dateBtn, error ? styles.dateBtnError : null]}
            onPress={onOpenTime}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Clock size={18} color={colors.primary} />
            <Text style={styles.dateBtnText} numberOfLines={1}>
              {formatDisplayTime(expiryTime)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FieldError message={error} />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}

      {showDatePicker && Platform.OS === "ios" ? (
        <View style={styles.pickerPanel}>
          <Text style={styles.pickerPanelTitle}>Pick expiry date</Text>
          <DateTimePicker
            value={expiryDate}
            mode="date"
            display="spinner"
            onChange={onDateChange}
            minimumDate={new Date()}
            style={styles.picker}
            {...IOS_PICKER_PROPS}
          />
          <TouchableOpacity style={styles.doneBtn} onPress={onCloseDate}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showTimePicker && Platform.OS === "ios" ? (
        <View style={styles.pickerPanel}>
          <Text style={styles.pickerPanelTitle}>Pick expiry time</Text>
          <DateTimePicker
            value={expiryTime}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            style={styles.picker}
            {...IOS_PICKER_PROPS}
          />
          <TouchableOpacity style={styles.doneBtn} onPress={onCloseTime}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={expiryDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      ) : null}

      {showTimePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={expiryTime}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  previewBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.15)",
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: 2,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  dateBtnError: {
    borderColor: colors.error,
  },
  dateBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  pickerPanel: {
    marginTop: spacing.sm,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  pickerPanelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  picker: {
    width: "100%",
    height: Platform.OS === "ios" ? 216 : undefined,
    backgroundColor: "#FFFFFF",
  },
  doneBtn: {
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  doneBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
});
