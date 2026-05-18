import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { saveDeviceToken } from "./notificationServices";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request push notification permissions from user
 * Must be called once when app starts
 */
export async function requestNotificationPermissions(userId: string) {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      console.log("Push notifications only work on physical devices");
      return false;
    }

    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not granted, ask user
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Permission to push notifications was denied");
      return false;
    }

    // Get device token (Expo token for development)
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Expo Push Token:", token);

    // Save token to Firebase
    await saveDeviceToken(userId, token);

    // Configure Android notification channel
    if (Device.osName === "Android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7F",
      });
    }

    return true;
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

/**
 * Handle incoming notifications
 * Call this once in your main app component
 */
export function setupNotificationListeners() {
  // Listen for notifications when app is running
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("Notification received:", notification);
      // Handle notification (e.g., show alert, update UI)
    }
  );

  // Listen for user tapping on a notification
  const responseListener =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response.notification);
      // Navigate to relevant screen based on notification data
      const actionUrl = response.notification.request.content.data?.actionUrl;
      if (actionUrl) {
        // Use router.push(actionUrl) to navigate
        console.log("Navigate to:", actionUrl);
      }
    });

  // Return cleanup function
  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}

/**
 * Send test notification (for development)
 */
export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧁 Test Notification",
        body: "This is a test push notification!",
        data: { type: "test" },
      },
      trigger: {
        seconds: 2, // Show after 2 seconds
      },
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
  }
}

/**
 * Send scheduled notification
 */
export async function scheduleNotification(
  title: string,
  body: string,
  delaySeconds: number = 10,
  data?: Record<string, any>
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        badge: 1,
      },
      trigger: {
        seconds: delaySeconds,
      },
    });
  } catch (error) {
    console.error("Error scheduling notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("All scheduled notifications canceled");
  } catch (error) {
    console.error("Error canceling notifications:", error);
  }
}
