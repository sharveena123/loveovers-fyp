import { auth } from "@/src/services/firebase/config";
import { getSellerPostAuthRoute } from "@/src/services/firebase/sellerRegistration";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { Stack, router } from "expo-router";
import { useEffect } from "react";

export default function SellerLayout() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (profile?.role === "seller") {
        const route = getSellerPostAuthRoute(profile as SellerProfile);
        if (route !== "/(seller)/(tabs)/dashboard") {
          router.replace(route);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen name="sellereditprofile" options={{ headerShown: false }} />
      <Stack.Screen name="analytics" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
