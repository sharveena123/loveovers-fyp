import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { FormField } from "@/src/components/FormField";
import { FormSubmitError } from "@/src/components/FieldError";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    SellerProfile,
    getUserProfile,
    updateSellerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
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
  const { user, loading: authLoading } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, SELLER_ROUTES.profile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [closingHour, setClosingHour] = useState("20");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (authLoading) return;

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
  }, [user?.uid, authLoading]);

  const handleSave = async () => {
    const nextErrors: FormErrors = {};
    if (!contactName.trim()) nextErrors.contactName = "Please enter your contact name";
    if (!businessName.trim()) nextErrors.businessName = "Please enter your business name";
    if (!phone.trim()) nextErrors.phone = "Please enter your phone number";
    if (!businessAddress.trim())
      nextErrors.businessAddress = "Please enter your business address";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
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
      setErrors({ submit: "Failed to save profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
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

            <FormSubmitError message={errors.submit} />

            <FormField label="Contact Name" error={errors.contactName}>
              <InputField
                value={contactName}
                onChangeText={(text) => {
                  setContactName(text);
                  setErrors((prev) => clearFieldError(prev, "contactName"));
                }}
                placeholder="Enter your contact name"
                hasError={!!errors.contactName}
              />
            </FormField>

            <FormField label="Business Name" error={errors.businessName}>
              <InputField
                value={businessName}
                onChangeText={(text) => {
                  setBusinessName(text);
                  setErrors((prev) => clearFieldError(prev, "businessName"));
                }}
                placeholder="Enter your business name"
                hasError={!!errors.businessName}
              />
            </FormField>

            <FormField label="Phone Number" error={errors.phone}>
              <InputField
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors((prev) => clearFieldError(prev, "phone"));
                }}
                placeholder="Enter your phone number"
                keyboardType="default"
                hasError={!!errors.phone}
              />
            </FormField>

            <FormField label="Business Address" error={errors.businessAddress}>
              <InputField
                value={businessAddress}
                onChangeText={(text) => {
                  setBusinessAddress(text);
                  setErrors((prev) => clearFieldError(prev, "businessAddress"));
                }}
                placeholder="Enter your business address"
                hasError={!!errors.businessAddress}
              />
            </FormField>

            <FormField
              label="Smart pricing — closing hour (24h)"
              helperText="Markdown ramps in the hours before this time (12–23, local time). Used for live buyer prices and AI simulator defaults."
            >
              <InputField
                value={closingHour}
                onChangeText={(t) =>
                  setClosingHour(t.replace(/[^0-9]/g, "").slice(0, 2))
                }
                placeholder="20"
                keyboardType="number-pad"
              />
            </FormField>

            <FormField label="Email" helperText="Email cannot be changed">
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{user?.email || "N/A"}</Text>
              </View>
            </FormField>
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
