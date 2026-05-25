import {
  FoodBusinessAddressField,
  type SelectedFoodPlace,
} from "@/src/components/auth/FoodBusinessAddressField";
import {
  ImageUploadField,
  MultiImageUploadField,
} from "@/src/components/auth/ImageUploadField";
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
  View
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

  const validateStep1 = (): boolean => {
    if (
      !contactName.trim() ||
      !businessName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert("Missing fields", "Please complete all account fields.");
      return false;
    }
    if (!useManualVerification) {
      if (!selectedPlace && hasGooglePlacesApiKey()) {
        Alert.alert(
          "Select your business",
          "Pick your café, bakery, or restaurant from the list.",
        );
        return false;
      }
      if (!businessAddress.trim()) {
        Alert.alert(
          "Business address",
          "Enter or select your business address.",
        );
        return false;
      }
    } else if (!businessAddress.trim()) {
      Alert.alert("Address", "Enter your pickup area or address.");
      return false;
    }
    if (!profileImageUri) {
      Alert.alert("Profile photo", "Please upload a profile image.");
      return false;
    }
    if (!email.includes("@")) {
      Alert.alert("Email", "Enter a valid email address.");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Password", "Password must be at least 6 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password", "Passwords do not match.");
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (verificationType === "business_verified") {
      if (!ssmNumber.trim() || !googleMapsLink.trim() || !storefrontUri) {
        Alert.alert(
          "Business verification",
          "SSM number, Google Maps link, and storefront photo are required.",
        );
        return false;
      }
      return true;
    }
    if (verificationType === "manual_verification") {
      if (
        workspaceUris.length === 0 ||
        sampleUris.length === 0 ||
        !socialMediaLink.trim() ||
        businessDescription.trim().length < 20
      ) {
        Alert.alert(
          "Manual verification",
          "Add workspace & sample photos, social link, and a short description (20+ characters).",
        );
        return false;
      }
      return true;
    }
    return false;
  };

  const handlePlaceSelected = (place: SelectedFoodPlace | null) => {
    setSelectedPlace(place);
    if (place?.displayName && !businessName.trim()) {
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
    if (!validateStep2() || !profileImageUri) return;

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
      }
      Alert.alert("Error", msg);
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
          {step === 1 && (
            <>
              <ImageUploadField
                label="Profile image"
                hint="Photo of owner or brand logo"
                uri={profileImageUri}
                onChange={setProfileImageUri}
                required
              />
              <Field
                label="Owner name"
                icon={<User size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="Your full name"
                  style={styles.input}
                />
              </Field>
              <Field
                label="Business name"
                icon={<Building2 size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Café / bakery name"
                  style={styles.input}
                />
              </Field>
              <Field
                label="Email"
                icon={<Mail size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@business.com"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </Field>
              <Field
                label="Phone"
                icon={<Phone size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="01x xxxx xxxx"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <FoodBusinessAddressField
                query={businessAddress}
                onQueryChange={setBusinessAddress}
                selectedPlace={selectedPlace}
                onPlaceSelected={handlePlaceSelected}
                manualMode={useManualVerification}
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
                  <Text style={styles.manualTitle}>
                    Home-based / not on Google Maps
                  </Text>
                  <Text style={styles.manualDesc}>
                    Use manual verification instead — our team will review your
                    photos and description (pending approval).
                  </Text>
                </View>
              </TouchableOpacity>

              <Field
                label="Password"
                icon={<Lock size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  secureTextEntry
                  style={styles.input}
                />
              </Field>
              <Field
                label="Confirm password"
                icon={<Lock size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  secureTextEntry
                  style={styles.input}
                />
              </Field>
              <PrimaryButton
                title="Continue"
                onPress={() => validateStep1() && setStep(2)}
              />
            </>
          )}

          {step === 2 && verificationType === "business_verified" && (
            <>
              <Text style={styles.sectionLead}>
                Registered business documents
              </Text>
              <Field label="SSM registration number">
                <InputField
                  value={ssmNumber}
                  onChangeText={setSsmNumber}
                  placeholder="e.g. 202401234567"
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
              >
                <InputField
                  value={googleMapsLink}
                  onChangeText={setGoogleMapsLink}
                  placeholder="Auto-filled when you pick a place"
                  style={styles.inputPlain}
                />
              </Field>
              <ImageUploadField
                label="Storefront photo"
                hint="Clear photo of your shop front"
                uri={storefrontUri}
                onChange={setStorefrontUri}
                required
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
                onChange={setWorkspaceUris}
                max={3}
                required
              />
              <MultiImageUploadField
                label="Sample product photos"
                hint="Examples of what you sell"
                uris={sampleUris}
                onChange={setSampleUris}
                max={3}
                required
              />
              <Field
                label="Social media business link"
                icon={<Link size={18} color={colors.textSoft} />}
              >
                <InputField
                  value={socialMediaLink}
                  onChangeText={setSocialMediaLink}
                  placeholder="Instagram / Facebook page URL"
                  style={styles.inputPlain}
                />
              </Field>
              <Text style={styles.label}>Short business description *</Text>
              <TextInput
                style={styles.textArea}
                value={businessDescription}
                onChangeText={setBusinessDescription}
                placeholder="What do you bake/sell, pickup area, typical surplus times…"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={colors.textSoft}
              />
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
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        {icon}
        <Text style={styles.label}>{label} *</Text>
      </View>
      {children}
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
    marginBottom: spacing.md,
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
