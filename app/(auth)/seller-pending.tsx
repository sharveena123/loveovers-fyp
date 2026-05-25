import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { getSellerPostAuthRoute } from "@/src/services/firebase/sellerRegistration";
import {
  getUserProfile,
  SellerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { Clock, ShieldAlert, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

export default function SellerPendingScreen() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
      return;
    }
    const p = await getUserProfile(user.uid);
    if (!p || p.role !== "seller") {
      router.replace("/");
      return;
    }
    const seller = p as SellerProfile;
    if (seller.verificationStatus === "approved") {
      router.replace(getSellerPostAuthRoute(seller));
      return;
    }
    setProfile(seller);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rejected = profile.verificationStatus === "rejected";
  const Icon = rejected ? XCircle : Clock;
  const iconColor = rejected ? colors.error : colors.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.iconWrap}>
          <Icon size={40} color={iconColor} />
        </View>
        <Text style={styles.title}>
          {rejected ? "Application not approved" : "Verification pending"}
        </Text>
        <Text style={styles.body}>
          {rejected
            ? profile.verificationReviewNote ||
              "Your manual verification was not approved. Contact support if you have questions."
            : "Thanks for registering! Our team is reviewing your home-based business submission. You'll get access to the seller dashboard once approved."}
        </Text>

        <View style={styles.infoCard}>
          <ShieldAlert size={20} color={colors.primary} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{profile.businessName}</Text>
            <Text style={styles.infoMeta}>
              Type: manual verification · Status: {profile.verificationStatus}
            </Text>
          </View>
        </View>

        {!rejected ? (
          <Text style={styles.hint}>
            Pull down to refresh status after admin approval.
          </Text>
        ) : null}

        <PrimaryButton
          title="Sign out"
          variant="outlined"
          onPress={handleSignOut}
          style={styles.btn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    alignItems: "center",
    paddingTop: spacing.xl * 2,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  infoCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  infoMeta: { fontSize: 13, color: colors.textSoft, marginTop: 4 },
  hint: {
    fontSize: 13,
    color: colors.textSoft,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  btn: { width: "100%", marginTop: spacing.sm },
});
