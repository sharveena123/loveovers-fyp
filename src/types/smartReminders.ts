export type SmartReminderPriority = "urgent" | "high" | "normal";

export type SmartReminderIcon =
  | "clock"
  | "cart"
  | "package"
  | "flame"
  | "alert"
  | "sparkles"
  | "message"
  | "trending";

export interface SmartReminder {
  id: string;
  title: string;
  message: string;
  icon: SmartReminderIcon;
  priority: SmartReminderPriority;
  actionUrl: string;
  actionLabel?: string;
}
