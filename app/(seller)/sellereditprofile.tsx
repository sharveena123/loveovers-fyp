import {
  FoodBusinessAddressField,
  type SelectedFoodPlace,
} from "@/src/components/auth/FoodBusinessAddressField";
import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { FormField } from "@/src/components/FormField";
import { FormSubmitError } from "@/src/components/FieldError";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  getUserProfile,
  isSellerLocationChangePending,
  isSellerPhoneChangePending,
  SellerProfile,
  requestSellerLocationChange,
  requestSellerPhoneChange,
  updateSellerProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import { goBackToReturn, SELLER_ROUTES } from "@/src/utils/navigation";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useState } from "react";
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
  const [approvedPhone, setApprovedPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePendingReview, setPhonePendingReview] = useState(false);
  const [approvedBusinessAddress, setApprovedBusinessAddress] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedFoodPlace | null>(
    null,
  );
  const [locationChangePending, setLocationChangePending] = useState(false);
  const [pendingLocationAddress, setPendingLocationAddress] = useState("");
  const [closingHour, setClosingHour] = useState("20");
  const [errors, setErrors] = useState<FormErrors>({});

  const canPickNewLocation = !locationChangePending;

  const applySellerProfile = (sellerProfile: SellerProfile) => {
    setContactName(sellerProfile.contactName || "");
    setBusinessName(sellerProfile.businessName || "");
    setApprovedPhone(sellerProfile.phone || "");
    setApprovedBusinessAddress(sellerProfile.businessAddress || "");

    const hasPendingLocation = isSellerLocationChangePending(sellerProfile);
    setLocationChangePending(hasPendingLocation);
    setPendingLocationAddress(
      hasPendingLocation ? sellerProfile.pendingBusinessAddress || "" : "",
    );

    const hasPendingPhone = isSellerPhoneChangePending(sellerProfile);
    setPhonePendingReview(hasPendingPhone);
    setPhone(
      hasPendingPhone
        ? sellerProfile.pendingPhone!.trim()
        : sellerProfile.phone || "",
    );
    setClosingHour(
      String(
        sellerProfile.smartPricingClosingHour != null
          ? sellerProfile.smartPricingClosingHour
          : 20,
      ),
    );

    if (!hasPendingLocation) {
      setLocationQuery("");
      setSelectedPlace(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      const fetchProfile = async () => {
        try {
          if (!user?.uid) {
            router.replace("/");
            return;
          }

          const userProfile = await getUserProfile(user.uid);
          if (userProfile && userProfile.role === "seller") {
            applySellerProfile(userProfile as SellerProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          Alert.alert("Error", "Failed to load profile");
        } finally {
          setLoading(false);
        }
      };

      setLoading(true);
      fetchProfile();
    }, [user?.uid, authLoading]),
  );

  const handleSave = async () => {
    const nextErrors: FormErrors = {};
    if (!contactName.trim()) {
      nextErrors.contactName = "Please enter your contact name";
    }
    if (!phone.trim()) nextErrors.phone = "Please enter your phone number";

    if (
      canPickNewLocation &&
      (locationQuery.trim() || selectedPlace)
    ) {
      if (!selectedPlace?.placeId) {
        nextErrors.businessAddress =
          "Select a valid location from the Google Maps suggestions";
      } else if (
        selectedPlace.formattedAddress.trim() ===
        approvedBusinessAddress.trim()
      ) {
        nextErrors.businessAddress =
          "Choose a different location from your current one";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      setSaving(true);
      if (!user?.uid) return;

      const h = parseInt(closingHour.trim(), 10);
      const smartHour = Number.isFinite(h) && h >= 12 && h <= 23 ? h : 20;

      await updateSellerProfile(user.uid, {
        contactName: contactName.trim(),
        smartPricingClosingHour: smartHour,
      });

      const trimmedPhone = phone.trim();
      const phoneChanged = trimmedPhone !== approvedPhone.trim();
      let phoneSubmitted = false;

      if (phoneChanged) {
        await requestSellerPhoneChange(user.uid, trimmedPhone);
        setPhonePendingReview(true);
        phoneSubmitted = true;
      }

      let locationSubmitted = false;
      if (canPickNewLocation && selectedPlace?.placeId) {
        await requestSellerLocationChange(user.uid, {
          businessAddress: selectedPlace.formattedAddress,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          googlePlaceId: selectedPlace.placeId,
          googleMapsLink: selectedPlace.googleMapsUri,
        });
        setLocationChangePending(true);
        setPendingLocationAddress(selectedPlace.formattedAddress);
        setLocationQuery("");
        setSelectedPlace(null);
        locationSubmitted = true;
      }

      let message = "Profile updated successfully";
      if (phoneSubmitted && locationSubmitted) {
        message =
          "Profile saved. Your new phone number and location were submitted for admin review in Firebase.";
      } else if (phoneSubmitted) {
        message =
          "Profile saved. Your new phone number was submitted for admin review — your current number stays active until it is approved.";
      } else if (locationSubmitted) {
        message =
          "Your new location was submitted for admin review. Your current address stays active until it is approved.";
      }

      Alert.alert("Success", message, [
        { text: "OK", onPress: handleBack },
      ]);
    } catch (error) {
      console.error("Error saving profile:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save profile. Please try again.";
      setErrors({ submit: message });
    } finally {
      setSaving(false);
    }
  };

  const locationHelperText = () => {
    if (locationChangePending) {
      return `New location pending admin approval in Firebase. Active address: ${approvedBusinessAddress || "—"}`;
    }
    return "To change address, search Google Maps, select a result, and save. Admin approves once in Firebase Console.";
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
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>

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

            <FormField
              label="Business Name"
              helperText="Contact support to change your registered business name"
            >
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{businessName || "—"}</Text>
              </View>
            </FormField>

            <FormField
              label="Phone Number"
              error={errors.phone}
              helperText={
                phonePendingReview
                  ? `Pending admin review. Active number: ${approvedPhone || "—"}`
                  : "Changes require admin approval before your listed number updates."
              }
            >
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
              label="Current address"
              helperText={locationHelperText()}
              error={errors.businessAddress}
            >
              <View
                style={[styles.disabledInput, styles.disabledInputMultiline]}
              >
                <Text style={styles.disabledText}>
                  {approvedBusinessAddress || "—"}
                </Text>
              </View>

              {locationChangePending && pendingLocationAddress ? (
                <View style={styles.pendingCard}>
                  <Text style={styles.pendingLabel}>Pending new location</Text>
                  <Text style={styles.pendingValue}>{pendingLocationAddress}</Text>
                </View>
              ) : null}

              {canPickNewLocation ? (
                <View style={styles.newLocationWrap}>
                  <FoodBusinessAddressField
                    query={locationQuery}
                    onQueryChange={(text) => {
                      setLocationQuery(text);
                      setErrors((prev) =>
                        clearFieldError(prev, "businessAddress"),
                      );
                    }}
                    selectedPlace={selectedPlace}
                    onPlaceSelected={(place) => {
                      setSelectedPlace(place);
                      if (place) {
                        setLocationQuery(place.formattedAddress);
                      }
                      setErrors((prev) =>
                        clearFieldError(prev, "businessAddress"),
                      );
                    }}
                    manualMode={true}
                    requireGooglePlace={true}
                    error={errors.businessAddress}
                  />
                </View>
              ) : null}
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
  disabledInputMultiline: {
    minHeight: 72,
    alignItems: "flex-start",
  },
  disabledText: {
    fontSize: 14,
    color: colors.textSoft,
  },
  pendingCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.2)",
  },
  pendingLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    marginBottom: 4,
  },
  pendingValue: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  newLocationWrap: {
    marginTop: spacing.md,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
});
