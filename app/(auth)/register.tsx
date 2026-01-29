import InputField from "@/src/components/InputField";
import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import {
  createBuyerProfile,
  createSellerProfile,
} from "@/src/services/firebase/user";
import { colors } from "@/src/theme/styles";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  Eye,
  Lock,
  Mail,
  MapPin,
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

  const handleRegister = async () => {
    // Validation
    if (userType === "seller") {
      if (
        !contactName ||
        !businessName ||
        !email ||
        !phone ||
        !businessAddress ||
        !password ||
        !confirmPassword
      ) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }
    } else {
      if (!contactName || !email || !phone || !password || !confirmPassword) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Create user profile in Firestore
      if (userType === "seller") {
        await createSellerProfile(
          user.uid,
          email,
          contactName,
          businessName,
          phone,
          businessAddress
        );
      } else {
        await createBuyerProfile(user.uid, email, contactName, phone);
      }

      Alert.alert("Success", "Account created successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Route based on role
            if (userType === "seller") {
              router.replace("/(seller)/dashboard");
            } else {
              router.replace("/(buyer)/buyerhome");
            }
          },
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

      Alert.alert("Registration Failed", errorMessage);
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
          {/* Header */}
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

            {/* Contact/Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {userType === "seller" ? "Contact Name" : "Full Name"}
              </Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <User size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="John Doe"
                  style={styles.inputWithIcon}
                />
              </View>
            </View>

            {/* Business Name - Only for Seller */}
            {userType === "seller" && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Business Name</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.iconContainer}>
                    <ShoppingBag size={20} color={colors.textSoft} />
                  </View>
                  <InputField
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Your Cafe/Bakery Name"
                    style={styles.inputWithIcon}
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Mail size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  style={styles.inputWithIcon}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Phone size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={phone}
                  onChangeText={setPhone}
                  placeholder=" 011 1234 5678"
                  keyboardType="numeric"
                  style={styles.inputWithIcon}
                />
              </View>
            </View>

            {/* Business Address - Only for Seller */}
            {userType === "seller" && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Business Address</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.iconContainer}>
                    <MapPin size={20} color={colors.textSoft} />
                  </View>
                  <InputField
                    value={businessAddress}
                    onChangeText={setBusinessAddress}
                    placeholder="123, Bukit Bintang, Kuala Lumpur"
                    style={styles.inputWithIcon}
                  />
                </View>
              </View>
            )}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Lock size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry={!showPassword}
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
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.iconContainer}>
                  <Lock size={20} color={colors.textSoft} />
                </View>
                <InputField
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  secureTextEntry={!showConfirmPassword}
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
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              By signing up, you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>

            <PrimaryButton
              title={loading ? "Creating Account..." : "Create Account"}
              onPress={handleRegister}
              disabled={loading}
              style={styles.signInButton}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>G</Text>
              <Text style={styles.socialButtonLabel}>Sign up with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>f</Text>
              <Text style={styles.socialButtonLabel}>
                Sign up with Facebook
              </Text>
            </TouchableOpacity>
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
  terms: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  signInButton: {
    marginBottom: 24,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textSoft,
    fontSize: 14,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 20,
    fontWeight: "600",
    marginRight: 12,
  },
  socialButtonLabel: {
    fontSize: 14,
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
