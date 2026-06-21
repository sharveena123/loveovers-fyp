import {
    FoodBusinessAddressField,
    type SelectedFoodPlace,
} from "@/src/components/auth/FoodBusinessAddressField";
import {
    ImageUploadField,
    MultiImageUploadField,
} from "@/src/components/auth/ImageUploadField";
import { FieldError, FormSubmitError } from "@/src/components/FieldError";
import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import {
    getSellerPostAuthRoute,
    registerSellerAccount,
    type SellerVerificationType,
} from "@/src/services/firebase/sellerRegistration";
import { hasGooglePlacesApiKey } from "@/src/services/places/googlePlaces";
import { colors, spacing } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import { router } from "expo-router";
import {
    Building2,
    Check,
    ChevronLeft,
    Link,
    Lock,
    Mail,
    Phone,
    User,
} from "lucide-react-native";
import { useState } from "react";
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Step = 1 | 2;

export default function SellerRegisterScreen() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [useManualVerification, setUseManualVerification] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SelectedFoodPlace | null>(
    null,
  );

  const verificationType: SellerVerificationType = useManualVerification
    ? "manual_verification"
    : "business_verified";

  const [ssmNumber, setSsmNumber] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  const [storefrontUri, setStorefrontUri] = useState<string | null>(null);

  const [workspaceUris, setWorkspaceUris] = useState<string[]>([]);
  const [sampleUris, setSampleUris] = useState<string[]>([]);
  const [socialMediaLink, setSocialMediaLink] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const buildStep1Errors = (): FormErrors => {
    const next: FormErrors = {};
    if (!contactName.trim()) next.contactName = "Owner name is required";
    if (!businessName.trim()) next.businessName = "Business name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!email.includes("@")) next.email = "Enter a valid email address";
    if (!phone.trim()) next.phone = "Phone number is required";
    if (!password) next.password = "Password is required";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword)
      next.confirmPassword = "Passwords do not match";
    if (!profileImageUri) next.profileImage = "Please upload a profile image";

    if (!useManualVerification) {
      if (!selectedPlace && hasGooglePlacesApiKey()) {
        next.businessAddress = "Pick your business from the search list";
      } else if (!businessAddress.trim()) {
        next.businessAddress = "Enter or select your business address";
      }
    } else if (!selectedPlace && hasGooglePlacesApiKey()) {
      next.businessAddress = "Pick your pickup location from Google Maps";
    } else if (!businessAddress.trim()) {
      next.businessAddress = "Enter or select your pickup location";
    }

    return next;
  };

  const buildStep2Errors = (): FormErrors => {
    const next: FormErrors = {};
    if (verificationType === "business_verified") {
      if (!ssmNumber.trim())
        next.ssmNumber = "SSM registration number is required";
      if (!googleMapsLink.trim())
        next.googleMapsLink = "Google Maps link is required";
      if (!storefrontUri) next.storefront = "Storefront photo is required";
    } else {
      if (workspaceUris.length === 0)
        next.workspacePhotos = "Add at least one workspace photo";
      if (sampleUris.length === 0)
        next.samplePhotos = "Add at least one sample product photo";
      if (!socialMediaLink.trim())
        next.socialMediaLink = "Social media link is required";
      if (businessDescription.trim().length < 20) {
        next.businessDescription = "Description must be at least 20 characters";
      }
    }
    return next;
  };

  const handlePlaceSelected = (place: SelectedFoodPlace | null) => {
    setSelectedPlace(place);
    if (
      place?.displayName &&
      !businessName.trim() &&
      !useManualVerification
    ) {
      setBusinessName(place.displayName);
    }
    if (place) {
      setGoogleMapsLink(place.googleMapsUri);
    }
  };

  const handleManualToggle = (value: boolean) => {
    setUseManualVerification(value);
    if (value) {
      setSelectedPlace(null);
      setGoogleMapsLink("");
    }
  };

  const handleSubmit = async () => {
    const stepErrors = buildStep2Errors();
    if (Object.keys(stepErrors).length > 0 || !profileImageUri) {
      if (!profileImageUri) {
        stepErrors.profileImage = "Please upload a profile image";
      }
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    const resolvedAddress =
      selectedPlace?.formattedAddress || businessAddress.trim();
    const resolvedMapsLink =
      selectedPlace?.googleMapsUri || googleMapsLink.trim();

    setLoading(true);
    try {
      const { profile } = await registerSellerAccount({
        email: email.trim(),
        password,
        contactName: contactName.trim(),
        businessName: businessName.trim(),
        phone: phone.trim(),
        businessAddress: resolvedAddress,
        profileImageUri,
        verificationType,
        latitude: selectedPlace?.latitude,
        longitude: selectedPlace?.longitude,
        googlePlaceId: selectedPlace?.placeId,
        business:
          verificationType === "business_verified"
            ? {
                ssmRegistrationNumber: ssmNumber.trim(),
                businessAddress: resolvedAddress,
                googleMapsLink: resolvedMapsLink,
                storefrontImageUri: storefrontUri!,
              }
            : undefined,
        manual:
          verificationType === "manual_verification"
            ? {
                workspacePhotoUris: workspaceUris,
                sampleProductPhotoUris: sampleUris,
                socialMediaLink: socialMediaLink.trim(),
                businessDescription: businessDescription.trim(),
              }
            : undefined,
      });

      const route = getSellerPostAuthRoute(profile);
      const message =
        profile.verificationStatus === "pending_review"
          ? "Your application was submitted. Our team will review it shortly."
          : "Your business account is ready. Welcome to LoveOvers!";

      Alert.alert("Registration complete", message, [
        { text: "OK", onPress: () => router.replace(route) },
      ]);
    } catch (error: unknown) {
      console.error("Seller registration error:", error);
      const err = error as { code?: string; message?: string };
      let msg = "Registration failed. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password is too weak.";
      } else if (err.code === "permission-denied") {
        msg =
          "Could not save your application. Please sign out and try again, or contact support.";
      } else if (err.message?.includes("Could not read image file")) {
        msg =
          "One of your photos could not be uploaded. Please re-select your images and try again.";
      } else if (
        err.message?.includes("invalid data") ||
        err.message?.includes("undefined")
      ) {
        msg = "Could not save your application. Please try again.";
      }
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() =>
            step > 1 ? setStep((step - 1) as Step) : router.replace("/")
          }
        >
          <ChevronLeft size={20} color={colors.primary} />
          <Text style={styles.backText}>{step > 1 ? "Back" : "Home"}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Seller registration</Text>
        <Text style={styles.subtitle}>
          Step {step} of 2 ·{" "}
          {step === 1
            ? "Account & location"
            : useManualVerification
              ? "Manual verification"
              : "Business verification"}
        </Text>

        <View style={styles.stepDots}>
          {[1, 2].map((n) => (
            <View key={n} style={[styles.dot, step >= n && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.card}>
          <FormSubmitError message={errors.submit} />

          {step === 1 && (
            <>
              <ImageUploadField
                label="Profile image"
                hint="Photo of owner or brand logo"
                uri={profileImageUri}
                onChange={(uri) => {
                  setProfileImageUri(uri);
                  setErrors((prev) => clearFieldError(prev, "profileImage"));
                }}
                required
                error={errors.profileImage}
              />
              <Field
                label="Owner name"
                icon={<User size={18} color={colors.textSoft} />}
                error={errors.contactName}
              >
                <InputField
                  value={contactName}
                  onChangeText={(text) => {
                    setContactName(text);
                    setErrors((prev) => clearFieldError(prev, "contactName"));
                  }}
                  placeholder="Your full name"
                  hasError={!!errors.contactName}
                  style={styles.input}
                />
              </Field>
              <Field
                label="Business name"
                icon={<Building2 size={18} color={colors.textSoft} />}
                error={errors.businessName}
              >
                <InputField
                  value={businessName}
                  onChangeText={(text) => {
                    setBusinessName(text);
                    setErrors((prev) => clearFieldError(prev, "businessName"));
                  }}
                  placeholder="Café / bakery name"
                  hasError={!!errors.businessName}
                  style={styles.input}
                />
              </Field>
              <Field
                label="Email"
                icon={<Mail size={18} color={colors.textSoft} />}
                error={errors.email}
              >
                <InputField
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrors((prev) => clearFieldError(prev, "email"));
                  }}
                  placeholder="you@business.com"
                  keyboardType="email-address"
                  hasError={!!errors.email}
                  style={styles.input}
                />
              </Field>
              <Field
                label="Phone"
                icon={<Phone size={18} color={colors.textSoft} />}
                error={errors.phone}
              >
                <InputField
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setErrors((prev) => clearFieldError(prev, "phone"));
                  }}
                  placeholder="01x xxxx xxxx"
                  keyboardType="numeric"
                  hasError={!!errors.phone}
                  style={styles.input}
                />
              </Field>
              <FoodBusinessAddressField
                query={businessAddress}
                onQueryChange={(text) => {
                  setBusinessAddress(text);
                  setErrors((prev) => clearFieldError(prev, "businessAddress"));
                }}
                selectedPlace={selectedPlace}
                onPlaceSelected={(place) => {
                  handlePlaceSelected(place);
                  setErrors((prev) => clearFieldError(prev, "businessAddress"));
                }}
                manualMode={useManualVerification}
                error={errors.businessAddress}
              />

              <TouchableOpacity
                style={styles.manualRow}
                onPress={() => handleManualToggle(!useManualVerification)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.checkbox,
                    useManualVerification && styles.checkboxOn,
                  ]}
                >
                  {useManualVerification ? (
                    <Check size={14} color={colors.white} />
                  ) : null}
                </View>
                <View style={styles.manualTextWrap}>
                  <Text style={styles.manualTitle}>Home-based seller</Text>
                  <Text style={styles.manualDesc}>
                    For home kitchens and small bakeries without a shopfront.
                    Pick your pickup area on Google Maps — our team will review
                    your photos before approval.
                  </Text>
                </View>
              </TouchableOpacity>

              <Field
                label="Password"
                icon={<Lock size={18} color={colors.textSoft} />}
                error={errors.password}
              >
                <InputField
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((prev) => clearFieldError(prev, "password"));
                  }}
                  placeholder="Min. 6 characters"
                  secureTextEntry
                  hasError={!!errors.password}
                  style={styles.input}
                />
              </Field>
              <Field
                label="Confirm password"
                icon={<Lock size={18} color={colors.textSoft} />}
                error={errors.confirmPassword}
              >
                <InputField
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors((prev) =>
                      clearFieldError(prev, "confirmPassword"),
                    );
                  }}
                  placeholder="Re-enter password"
                  secureTextEntry
                  hasError={!!errors.confirmPassword}
                  style={styles.input}
                />
              </Field>
              <PrimaryButton
                title="Continue"
                onPress={() => {
                  const stepErrors = buildStep1Errors();
                  if (Object.keys(stepErrors).length > 0) {
                    setErrors(stepErrors);
                    return;
                  }
                  setErrors({});
                  setStep(2);
                }}
              />
            </>
          )}

          {step === 2 && verificationType === "business_verified" && (
            <>
              <Text style={styles.sectionLead}>
                Registered business documents
              </Text>
              <Field label="SSM registration number" error={errors.ssmNumber}>
                <InputField
                  value={ssmNumber}
                  onChangeText={(text) => {
                    setSsmNumber(text);
                    setErrors((prev) => clearFieldError(prev, "ssmNumber"));
                  }}
                  placeholder="e.g. 202401234567"
                  hasError={!!errors.ssmNumber}
                  style={styles.inputPlain}
                />
              </Field>
              <View style={styles.readOnlyCard}>
                <Building2 size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.readOnlyLabel}>Selected business</Text>
                  <Text style={styles.readOnlyValue} numberOfLines={3}>
                    {selectedPlace?.displayName || businessName}
                  </Text>
                  <Text style={styles.readOnlySub} numberOfLines={2}>
                    {businessAddress}
                  </Text>
                </View>
              </View>
              <Field
                label="Google Maps link"
                icon={<Link size={18} color={colors.textSoft} />}
                error={errors.googleMapsLink}
              >
                <InputField
                  value={googleMapsLink}
                  onChangeText={(text) => {
                    setGoogleMapsLink(text);
                    setErrors((prev) =>
                      clearFieldError(prev, "googleMapsLink"),
                    );
                  }}
                  placeholder="Auto-filled when you pick a place"
                  hasError={!!errors.googleMapsLink}
                  style={styles.inputPlain}
                />
              </Field>
              <ImageUploadField
                label="Storefront photo"
                hint="Clear photo of your shop front"
                uri={storefrontUri}
                onChange={(uri) => {
                  setStorefrontUri(uri);
                  setErrors((prev) => clearFieldError(prev, "storefront"));
                }}
                required
                error={errors.storefront}
              />
              <PrimaryButton
                title={loading ? "Submitting…" : "Submit registration"}
                onPress={handleSubmit}
                disabled={loading}
              />
            </>
          )}

          {step === 2 && verificationType === "manual_verification" && (
            <>
              <Text style={styles.sectionLead}>
                Tell us about your home or small bakery
              </Text>
              <MultiImageUploadField
                label="Workspace / bakery photos"
                hint="Kitchen, prep area, or workspace"
                uris={workspaceUris}
                onChange={(uris) => {
                  setWorkspaceUris(uris);
                  setErrors((prev) => clearFieldError(prev, "workspacePhotos"));
                }}
                max={3}
                required
                error={errors.workspacePhotos}
              />
              <MultiImageUploadField
                label="Sample product photos"
                hint="Examples of what you sell"
                uris={sampleUris}
                onChange={(uris) => {
                  setSampleUris(uris);
                  setErrors((prev) => clearFieldError(prev, "samplePhotos"));
                }}
                max={3}
                required
                error={errors.samplePhotos}
              />
              <Field
                label="Social media business link"
                icon={<Link size={18} color={colors.textSoft} />}
                error={errors.socialMediaLink}
              >
                <InputField
                  value={socialMediaLink}
                  onChangeText={(text) => {
                    setSocialMediaLink(text);
                    setErrors((prev) =>
                      clearFieldError(prev, "socialMediaLink"),
                    );
                  }}
                  placeholder="Instagram / Facebook page URL"
                  hasError={!!errors.socialMediaLink}
                  style={styles.inputPlain}
                />
              </Field>
              <Text style={styles.label}>Short business description *</Text>
              <TextInput
                style={[
                  styles.textArea,
                  errors.businessDescription ? styles.textAreaError : null,
                ]}
                value={businessDescription}
                onChangeText={(text) => {
                  setBusinessDescription(text);
                  setErrors((prev) =>
                    clearFieldError(prev, "businessDescription"),
                  );
                }}
                placeholder="What do you bake/sell, pickup area, typical surplus times…"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={colors.textSoft}
              />
              <FieldError message={errors.businessDescription} />
              <View style={styles.pendingNote}>
                <Text style={styles.pendingNoteText}>
                  After submit, your status will be pending_review until an
                  admin approves your application.
                </Text>
              </View>
              <PrimaryButton
                title={loading ? "Submitting…" : "Submit for review"}
                onPress={handleSubmit}
                disabled={loading}
              />
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.signInLink}>
            Already have an account?{" "}
            <Text style={styles.signInBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  icon,
  children,
  error,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        {icon}
        <Text style={styles.label}>{label} *</Text>
      </View>
      {children}
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.md,
  },
  backText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: { fontSize: 15, color: colors.textSoft, marginBottom: spacing.md },
  stepDots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.lg,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLead: {
    fontSize: 14,
    color: colors.textSoft,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  field: { marginBottom: spacing.md },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  input: { paddingLeft: 4 },
  inputPlain: {},
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 100,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textAreaError: {
    borderColor: colors.error,
  },
  typeCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
  },
  manualTextWrap: { flex: 1 },
  manualTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  manualDesc: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 4,
    lineHeight: 17,
  },
  readOnlyCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  readOnlyLabel: { fontSize: 12, color: colors.textSoft },
  readOnlyValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  readOnlySub: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  pendingNote: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  pendingNoteText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  signInLink: { textAlign: "center", fontSize: 14, color: colors.textSoft },
  signInBold: { color: colors.primary, fontWeight: "700" },
});
