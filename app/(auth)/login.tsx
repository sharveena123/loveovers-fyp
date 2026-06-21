import { FormSubmitError } from "@/src/components/FieldError";
import { FormField } from "@/src/components/FormField";
import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { getSellerPostAuthRoute } from "@/src/services/firebase/sellerRegistration";
import { getUserProfile, SellerProfile } from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import {
  clearFieldError,
  FormErrors,
  hasFormErrors,
  validateLoginForm,
} from "@/src/utils/formValidation";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ChevronLeft, Eye, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleLogin = async () => {
    const nextErrors = validateLoginForm({ email, password });

    if (hasFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        throw new Error("User profile not found");
      }

      if (profile.role === "seller") {
        router.replace(getSellerPostAuthRoute(profile as SellerProfile));
      } else {
        router.replace("/(buyer)/buyerhome");
      }
    } catch (error: unknown) {
      console.error("Login error:", error);

      let errorMessage = "Something went wrong. Please try again.";
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
      ) {
        errorMessage = "Invalid email or password";
      }

      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backLink}
        onPress={() => router.replace("/")}
        activeOpacity={0.8}
      >
        <ChevronLeft size={20} color={colors.primary} />
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Welcome Back!</Text>
      <Text style={styles.subtitle}>
        Save food, save money, save the planet
      </Text>

      <View style={styles.formCard}>
        <FormSubmitError message={errors.submit} />

        <FormField label="Email Address" error={errors.email}>
          <View style={styles.inputWrapper}>
            <Mail size={20} color={colors.textSoft} style={styles.inputIcon} />
            <InputField
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => clearFieldError(prev, "email"));
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              hasError={!!errors.email}
              style={styles.input}
            />
          </View>
        </FormField>

        <FormField label="Password" error={errors.password}>
          <View style={styles.inputWrapper}>
            <Lock size={20} color={colors.textSoft} style={styles.inputIcon} />
            <InputField
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors((prev) => clearFieldError(prev, "password"));
              }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              hasError={!!errors.password}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Eye size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </FormField>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/forgotpassword")}
          style={styles.forgotPassword}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <PrimaryButton
          title={loading ? "Signing in..." : "Sign In"}
          onPress={handleLogin}
          disabled={loading}
          style={styles.signInButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    gap: 4,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
    pointerEvents: "none",
  },
  input: {
    flex: 1,
    paddingLeft: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: colors.primary,
  },
  footer: {
    flexDirection: "row",
    marginTop: 24,
    backgroundColor: colors.background,
  },
  footerText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  signUpText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
