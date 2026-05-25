import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    SellerProfile,
    getUserProfile,
    updateSellerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { goBackToReturn, SELLER_ROUTES } from "@/src/utils/navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

export default function SellerEditProfile() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, SELLER_ROUTES.profile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [closingHour, setClosingHour] = useState("20");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user?.uid) {
          Alert.alert("Error", "User not authenticated");
          handleBack();
          return;
        }

        const userProfile = await getUserProfile(user.uid);
        if (userProfile && userProfile.role === "seller") {
          const sellerProfile = userProfile as SellerProfile;
          setContactName(sellerProfile.contactName || "");
          setBusinessName(sellerProfile.businessName || "");
          setPhone(sellerProfile.phone || "");
          setBusinessAddress(sellerProfile.businessAddress || "");
          setClosingHour(
            String(
              sellerProfile.smartPricingClosingHour != null
                ? sellerProfile.smartPricingClosingHour
                : 20,
            ),
          );
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        Alert.alert("Error", "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.uid, router]);

  const handleSave = async () => {
    if (!contactName.trim()) {
      Alert.alert("Validation", "Please enter your contact name");
      return;
    }

    if (!businessName.trim()) {
      Alert.alert("Validation", "Please enter your business name");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Validation", "Please enter your phone number");
      return;
    }

    if (!businessAddress.trim()) {
      Alert.alert("Validation", "Please enter your business address");
      return;
    }

    try {
      setSaving(true);
      if (user?.uid) {
        const h = parseInt(closingHour.trim(), 10);
        const smartHour =
          Number.isFinite(h) && h >= 12 && h <= 23 ? h : 20;
        await updateSellerProfile(user.uid, {
          contactName: contactName.trim(),
          businessName: businessName.trim(),
          phone: phone.trim(),
          businessAddress: businessAddress.trim(),
          smartPricingClosingHour: smartHour,
        });
        Alert.alert("Success", "Profile updated successfully", [
          {
            text: "OK",
            onPress: handleBack,
          },
        ]);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Information</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Name</Text>
              <InputField
                value={contactName}
                onChangeText={setContactName}
                placeholder="Enter your contact name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Business Name</Text>
              <InputField
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Enter your business name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <InputField
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Business Address</Text>
              <InputField
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="Enter your business address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Smart pricing — closing hour (24h)</Text>
              <InputField
                value={closingHour}
                onChangeText={(t) =>
                  setClosingHour(t.replace(/[^0-9]/g, "").slice(0, 2))
                }
                placeholder="20"
                keyboardType="number-pad"
              />
              <Text style={styles.helperText}>
                Markdown ramps in the hours before this time (12–23, local time).
                Used for live buyer prices and AI simulator defaults.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.disabledInput]}>
                <Text style={styles.disabledText}>{user?.email || "N/A"}</Text>
              </View>
              <Text style={styles.helperText}>Email cannot be changed</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <PrimaryButton
              title={saving ? "Saving..." : "Save Changes"}
              onPress={handleSave}
              disabled={saving}
            />
            <PrimaryButton
              title="Cancel"
              onPress={handleBack}
              variant="outlined"
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
  },
  formContainer: {
    padding: spacing.lg,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  disabledInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
  },
  disabledText: {
    fontSize: 14,
    color: colors.textSoft,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
});
