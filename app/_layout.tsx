import { ThemeProvider } from "@/src/hooks/useTheme";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans";
import { Poppins_600SemiBold, useFonts } from "@expo-google-fonts/poppins";
import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import { useEffect } from "react";

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    DMSans_400Regular,
  });

  useEffect(() => {}, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(seller)" />
          <Stack.Screen name="(buyer)" />
          <Stack.Screen name="index" />
        </Stack>
      </StripeProvider>
    </ThemeProvider>
  );
}
