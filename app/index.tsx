import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { getSellerPostAuthRoute } from "@/src/services/firebase/sellerRegistration";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Leaf, ShoppingBag, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

async function routeByRole(uid: string) {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  if (profile.role === "seller") {
    router.replace(getSellerPostAuthRoute(profile as SellerProfile));
  } else {
    router.replace("/(buyer)/buyerhome");
  }
}

export default function LandingScreen() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          await routeByRole(user.uid);
        } catch {
          setCheckingSession(false);
        }
        return;
      }
      setCheckingSession(false);
    });
    return unsubscribe;
  }, []);

  if (checkingSession) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#fff7ef", "#f5ebe0", "#e7f1e5"]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <ShoppingBag size={48} color={colors.primary} strokeWidth={1.75} />
            </View>
            <Text style={styles.brand}>LoveOvers</Text>
            <Text style={styles.tagline}>
              Rescue surplus food. Save money. Cut waste.
            </Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureCard}>
              <ShoppingBag size={22} color={colors.primary} />
              <Text style={styles.featureTitle}>Mystery bags</Text>
              <Text style={styles.featureText}>
                Surprise deals from local cafés & bakeries
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Leaf size={22} color={colors.success} />
              <Text style={styles.featureTitle}>Real impact</Text>
              <Text style={styles.featureText}>
                Every rescue keeps good food out of the bin
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              title="Log in"
              onPress={() => router.push("/(auth)/login")}
            />
            <PrimaryButton
              title="Create account"
              variant="outlined"
              onPress={() => router.push("/(auth)/register")}
              style={styles.registerBtn}
            />
            <TouchableOpacity
              onPress={() => router.push("/(auth)/seller-register")}
              style={styles.sellerLink}
            >
              <Text style={styles.sellerLinkText}>
                Register as a seller (business or home bakery)
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.browseHint}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.8}
          >
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.browseHintText}>
              Sellers: list surplus · Buyers: discover nearby deals
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: "space-between",
  },
  hero: {
    alignItems: "center",
    paddingTop: spacing.xl,
  },
  logoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: "rgba(106,60,0,0.15)",
    shadowColor: "#6a3c00",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  featureRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.1)",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
  registerBtn: {
    marginTop: 0,
  },
  sellerLink: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sellerLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "center",
  },
  browseHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  browseHintText: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    flex: 1,
  },
});
