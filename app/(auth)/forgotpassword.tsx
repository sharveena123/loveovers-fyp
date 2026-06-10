import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { FormField } from "@/src/components/FormField";
import { FormSubmitError } from "@/src/components/FieldError";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { colors } from "@/src/theme/styles";
import { clearFieldError, FormErrors } from "@/src/utils/formValidation";
import { router } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, Mail } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");

  const handleResetPassword = async () => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!email.includes("@")) {
      nextErrors.email = "Enter a valid email address";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSuccessMessage("");
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Password reset link sent! Check your email.");
    } catch (error: unknown) {
      console.error("Password reset error:", error);

      let errorMessage = "Something went wrong. Please try again.";
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      }

      setErrors({ email: errorMessage });
      setSuccessMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <ArrowLeft size={24} color={colors.text} />
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        No worries! Enter your email and we'll send you reset instructions.
      </Text>

      <View style={styles.formCard}>
        {successMessage ? (
          <Text style={styles.successText}>{successMessage}</Text>
        ) : null}

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
                setSuccessMessage("");
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              hasError={!!errors.email}
              style={styles.inputWithIcon}
            />
          </View>
        </FormField>

        <PrimaryButton
          title={loading ? "Sending..." : "Send Reset Link"}
          onPress={handleResetPassword}
          disabled={loading}
          style={styles.sendButton}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            • We'll send a password reset link to your email
          </Text>
          <Text style={styles.infoText}>
            • Click the link within 1 hour to reset your password
          </Text>
          <Text style={styles.infoText}>• Create a new secure password</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Remember your password? </Text>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.signInText}>Sign In</Text>
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
  backButton: {
    position: "absolute",
    top: 60,
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
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
    paddingHorizontal: 20,
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
  iconContainer: {
    position: "absolute",
    left: 12,
    zIndex: 1,
    pointerEvents: "none",
  },
  inputWithIcon: {
    flex: 1,
    paddingLeft: 40,
    paddingRight: 12,
  },
  sendButton: {
    marginBottom: 24,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: 8,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: "600",
  },
});
