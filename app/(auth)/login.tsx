import InputField from '@/src/components/InputField'
import PrimaryButton from '@/src/components/PrimaryButton'
import { Text } from '@/src/components/StyledText'
import { auth } from '@/src/services/firebase/config'
import { getUserProfile } from '@/src/services/firebase/user'
import { colors } from '@/src/theme/styles'
import { router } from 'expo-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { Eye, Lock, Mail } from 'lucide-react-native'
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

      // Route based on role
      if (profile.role === 'seller') {
        router.replace('/(seller)/dashboard')
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

  const handleGoogleLogin = () => {
    Alert.alert('Google Login', 'Coming soon!')
  }

  const handleFacebookLogin = () => {
    Alert.alert('Facebook Login', 'Coming soon!')
  }

  return (
    <View style={styles.container}>
      {/* Logo */}
      {/* <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>🛍️</Text>
        </View>
      </View> */}

      {/* Header */}
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

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
          <Text style={styles.socialButtonText}>G</Text>
          <Text style={styles.socialButtonLabel}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton} onPress={handleFacebookLogin}>
          <Text style={styles.socialButtonText}>f</Text>
          <Text style={styles.socialButtonLabel}>Continue with Facebook</Text>
        </TouchableOpacity>
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
    marginBottom: 24,
    backgroundColor: colors.primary, 
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 12,
  },
  socialButtonLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
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