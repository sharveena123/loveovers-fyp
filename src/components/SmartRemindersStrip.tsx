import type { SmartReminder, SmartReminderIcon } from "@/src/types/smartReminders";
import { colors, spacing } from "@/src/theme/styles";
import { router } from "expo-router";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  Flame,
  MessageSquare,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function ReminderIcon({
  icon,
  priority,
}: {
  icon: SmartReminderIcon;
  priority: SmartReminder["priority"];
}) {
  const color =
    priority === "urgent"
      ? colors.error
      : priority === "high"
        ? colors.primary
        : colors.success;
  const size = 18;

  switch (icon) {
    case "clock":
      return <Clock size={size} color={color} />;
    case "cart":
      return <ShoppingCart size={size} color={color} />;
    case "package":
      return <Package size={size} color={color} />;
    case "flame":
      return <Flame size={size} color={color} />;
    case "alert":
      return <AlertCircle size={size} color={color} />;
    case "message":
      return <MessageSquare size={size} color={color} />;
    case "trending":
      return <TrendingDown size={size} color={color} />;
    default:
      return <Sparkles size={size} color={color} />;
  }
}

interface SmartRemindersStripProps {
  reminders: SmartReminder[];
  loading?: boolean;
  onDismiss: (id: string) => void;
  title?: string;
  /** When parent already has horizontal padding (e.g. seller dashboard body). */
  embedded?: boolean;
}

export function SmartRemindersStrip({
  reminders,
  loading = false,
  onDismiss,
  title = "Smart reminders",
  embedded = false,
}: SmartRemindersStripProps) {
  if (loading && reminders.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (reminders.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.headerRow, embedded && styles.headerRowEmbedded]}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          embedded && styles.scrollContentEmbedded,
        ]}
      >
        {reminders.map((reminder, index) => {
          const isUrgent = reminder.priority === "urgent";
          return (
            <TouchableOpacity
              key={reminder.id}
              style={[
                styles.card,
                index < reminders.length - 1 && styles.cardSpacing,
                isUrgent && styles.cardUrgent,
              ]}
              activeOpacity={0.9}
              onPress={() => router.push(reminder.actionUrl as never)}
            >
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.iconWrap,
                    isUrgent && styles.iconWrapUrgent,
                  ]}
                >
                  <ReminderIcon
                    icon={reminder.icon}
                    priority={reminder.priority}
                  />
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onDismiss(reminder.id)}
                >
                  <X size={16} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {reminder.title}
              </Text>
              <Text style={styles.cardMessage} numberOfLines={3}>
                {reminder.message}
              </Text>
              <View style={styles.cardAction}>
                <Text style={styles.cardActionText}>
                  {reminder.actionLabel ?? "View"}
                </Text>
                <ChevronRight size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  loadingWrap: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  headerRowEmbedded: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.lg,
  },
  scrollContentEmbedded: {
    paddingHorizontal: 0,
  },
  cardSpacing: {
    marginRight: spacing.md,
  },
  card: {
    width: 260,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUrgent: {
    borderColor: colors.errorSoft,
    backgroundColor: "#fffaf8",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapUrgent: {
    backgroundColor: colors.errorSoft,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
    flex: 1,
  },
  cardAction: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 2,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
});
