import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { FormField } from "@/src/components/FormField";
import { FormSubmitError } from "@/src/components/FieldError";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    BuyerProfile,
    getUserProfile,
    updateBuyerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import { BUYER_ROUTES, goBackToReturn } from "@/src/utils/navigation";
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

export default function BuyerEditProfile() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.profile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (authLoading) return;

    const fetchProfile = async () => {
      try {
        if (!user?.uid) {
          // Signed out (e.g. logout while this screen is in the stack) — leave quietly.
          router.replace("/");
          return;
        }

        const userProfile = await getUserProfile(user.uid);
        if (userProfile && userProfile.role === "buyer") {
          const buyerProfile = userProfile as BuyerProfile;
          setFullName(buyerProfile.fullName || "");
          setPhone(buyerProfile.phone || "");
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
    if (!fullName.trim()) nextErrors.fullName = "Please enter your full name";
    if (!phone.trim()) nextErrors.phone = "Please enter your phone number";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      setSaving(true);
      if (user?.uid) {
        await updateBuyerProfile(user.uid, {
          fullName: fullName.trim(),
          phone: phone.trim(),
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
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <FormSubmitError message={errors.submit} />

            <FormField label="Full Name" error={errors.fullName}>
              <InputField
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setErrors((prev) => clearFieldError(prev, "fullName"));
                }}
                placeholder="Enter your full name"
                hasError={!!errors.fullName}
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

            <FormField
              label="Email"
              helperText="Email cannot be changed"
            >
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
