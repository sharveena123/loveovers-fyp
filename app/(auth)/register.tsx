import { FormSubmitError } from "@/src/components/FieldError";
import { FormField } from "@/src/components/FormField";
import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { createBuyerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import {
    clearFieldError,
    FormErrors,
    hasFormErrors,
    validateRegistrationForm,
} from "@/src/utils/formValidation";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    ChevronLeft,
    Eye,
    Lock,
    Mail,
    Phone,
    ShoppingBag,
    User,
} from "lucide-react-native";
import { useState } from "react";
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

export default function RegisterScreen() {
  const [userType, setUserType] = useState<"buyer" | "seller">("buyer");
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleRegister = async () => {
    if (userType === "seller") {
      router.push("/(auth)/seller-register");
      return;
    }

    const nextErrors = validateRegistrationForm({
      contactName,
      email,
      phone,
      password,
      confirmPassword,
    });

    if (hasFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      await createBuyerProfile(user.uid, email, contactName, phone);

      Alert.alert("Success", "Account created successfully!", [
        {
          text: "OK",
          onPress: () => router.replace("/(buyer)/buyerhome"),
        },
      ]);
    } catch (error: any) {
      console.error("Registration error:", error);

      let errorMessage = "Something went wrong";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      }

      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.replace("/")}
            activeOpacity={0.8}
          >
            <ChevronLeft size={20} color={colors.primary} />
            <Text style={styles.backLinkText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the fight against food waste</Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  userType === "buyer" && styles.toggleButtonActive,
                ]}
                onPress={() => setUserType("buyer")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    userType === "buyer" && styles.toggleTextActive,
                  ]}
                >
                  Buyer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  userType === "seller" && styles.toggleButtonActive,
                ]}
                onPress={() => setUserType("seller")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    userType === "seller" && styles.toggleTextActive,
                  ]}
                >
                  Seller
                </Text>
              </TouchableOpacity>
            </View>

            <FormSubmitError message={errors.submit} />

            {/* Contact/Full Name */}
            <FormField
              label={userType === "seller" ? "Contact Name" : "Full Name"}
              error={errors.contactName}
            >
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <User size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={contactName}
                  onChangeText={(text) => {
                    setContactName(text);
                    setErrors((prev) => clearFieldError(prev, "contactName"));
                  }}
                  placeholder="John Doe"
                  hasError={!!errors.contactName}
                  style={styles.inputWithIcon}
                />
              </View>
            </FormField>

            {userType === "seller" && (
              <View style={styles.sellerBanner}>
                <ShoppingBag size={22} color={colors.primary} />
                <Text style={styles.sellerBannerText}>
                  Sellers complete a 3-step registration with business or manual
                  verification, photo uploads, and admin review for home-based
                  businesses.
                </Text>
              </View>
            )}

            {/* Email */}
            <FormField label="Email Address" error={errors.email}>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Mail size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrors((prev) => clearFieldError(prev, "email"));
                  }}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  hasError={!!errors.email}
                  style={styles.inputWithIcon}
                />
              </View>
            </FormField>

            {/* Phone */}
            <FormField label="Phone Number" error={errors.phone}>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Phone size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setErrors((prev) => clearFieldError(prev, "phone"));
                  }}
                  placeholder=" 011 1234 5678"
                  keyboardType="numeric"
                  hasError={!!errors.phone}
                  style={styles.inputWithIcon}
                />
              </View>
            </FormField>

            {/* Password */}
            <FormField label="Password" error={errors.password}>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Lock size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((prev) => clearFieldError(prev, "password"));
                  }}
                  placeholder="At least 6 characters"
                  secureTextEntry={!showPassword}
                  hasError={!!errors.password}
                  style={styles.inputWithIcon}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Eye size={20} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
            </FormField>

            {/* Confirm Password */}
            <FormField label="Confirm Password" error={errors.confirmPassword}>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Lock size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors((prev) =>
                      clearFieldError(prev, "confirmPassword"),
                    );
                  }}
                  placeholder="Re-enter your password"
                  secureTextEntry={!showConfirmPassword}
                  hasError={!!errors.confirmPassword}
                  style={styles.inputWithIcon}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Eye size={20} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
            </FormField>

            {/* Terms */}
            <Text style={styles.terms}>
              By signing up, you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>

            <PrimaryButton
              title={
                loading
                  ? "Creating Account..."
                  : userType === "seller"
                    ? "Continue to seller registration"
                    : "Create Account"
              }
              onPress={handleRegister}
              disabled={loading}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleSignIn}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  container: {
    width: "100%",
    alignItems: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
    gap: 4,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSoft,
    marginBottom: 32,
    textAlign: "center",
  },
  formCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  iconContainer: {
    position: "absolute",
    left: 12,
    zIndex: 1,
    pointerEvents: "none",
  },
  inputWithIcon: {
    flex: 1,
    paddingLeft: 40,
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    color: colors.textSoft,
  },
  toggleTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  sellerBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  sellerBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  terms: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    marginTop: 24,
  },
  footerText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  signInText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
});
