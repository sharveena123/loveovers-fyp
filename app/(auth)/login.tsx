import InputField from '@/src/components/InputField'
import PrimaryButton from '@/src/components/PrimaryButton'
import { Text } from '@/src/components/StyledText'
import { auth } from '@/src/services/firebase/config'
import { getSellerPostAuthRoute } from '@/src/services/firebase/sellerRegistration'
import { getUserProfile, SellerProfile } from '@/src/services/firebase/user'
import { colors, spacing } from '@/src/theme/styles'
import { router } from 'expo-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { ChevronLeft, Eye, Lock, Mail } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Get user profile to determine role
      const profile = await getUserProfile(user.uid)

      if (!profile) {
        throw new Error('User profile not found')
      }

      if (profile.role === 'seller') {
        router.replace(getSellerPostAuthRoute(profile as SellerProfile))
      } else {
        router.replace('/(buyer)/buyerhome')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      let errorMessage = 'Something went wrong'
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password'
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password'
      }
      
      Alert.alert('Login Failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    router.push('/(auth)/forgotpassword')
  }

  const handleSignUp = () => {
    router.push('/(auth)/register')
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backLink}
        onPress={() => router.replace('/')}
        activeOpacity={0.8}
      >
        <ChevronLeft size={20} color={colors.primary} />
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Welcome Back!</Text>
      <Text style={styles.subtitle}>Save food, save money, save the planet</Text>

      {/* Form Card */}
      <View style={styles.formCard}>
        {/* Email */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <Mail size={20} color={colors.textSoft} style={styles.inputIcon} />
            <InputField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={20} color={colors.textSoft} style={styles.inputIcon} />
            <InputField
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Eye size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password */}
        <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <PrimaryButton
          title={loading ? 'Signing in...' : 'Sign In'}
          onPress={handleLogin}
          disabled={loading}
          style={styles.signInButton}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={handleSignUp}>
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    gap: 4,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSoft,
    marginBottom: 32,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
    pointerEvents: 'none',
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
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: colors.primary,
  },
  footer: {
    flexDirection: 'row',
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
    fontWeight: '600',
  },
})