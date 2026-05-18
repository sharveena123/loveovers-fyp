import React, { useEffect, useState, useCallback } from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { Bell } from "lucide-react-native";
import { useAuth } from "@/src/hooks/useAuth";
import { getUserNotifications } from "@/src/services/firebase/notificationServices";
import { useFocusEffect } from "expo-router";

interface NotificationBellProps {
  onPress: () => void;
  color?: string;
}

export function NotificationBell({ onPress, color = "#2C3E50" }: NotificationBellProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const notifications = await getUserNotifications(user.uid, 100, true);
      setUnreadCount(notifications.length);
    } catch (error) {
      console.error("Error loading unread notifications:", error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
      // Refresh every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }, [loadUnreadCount])
  );

  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <Bell size={24} color={color} strokeWidth={2} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#E74C3C",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
});
