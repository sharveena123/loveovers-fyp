import { useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  requestNotificationPermissions,
  setupNotificationListeners,
} from "@/src/services/firebase/pushNotificationSetup";

/**
 * Hook to initialize push notifications
 * Call once in your root app component
 *
 * Usage:
 * export default function App() {
 *   usePushNotifications();
 *   return <RootNavigator />;
 * }
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Request permissions on app start
    requestNotificationPermissions(user.uid).then((granted) => {
      if (granted) {
        console.log("✅ Push notifications enabled");
      } else {
        console.log("❌ Push notifications denied");
      }
    });

    // Setup listeners for incoming notifications
    const cleanup = setupNotificationListeners();

    // Cleanup on unmount
    return cleanup;
  }, [user]);
}
