import { Text } from '@/src/components/StyledText'
import { auth } from '@/src/services/firebase/config'
import { getProfileStats, ProfileStats } from '@/src/services/firebase/profile'
import { getUserProfile, SellerProfile, updateSellerSettings } from '@/src/services/firebase/user'
import { colors, spacing } from '@/src/theme/styles'
import { router } from 'expo-router'
import { signOut } from 'firebase/auth'
import {
  AlertCircle,
  BarChart3,
  Bell,
  ChevronRight,
  CreditCard,
  Edit2,
  HelpCircle,
  Leaf,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Settings,
  Star,
} from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const user = auth.currentUser
    if (!user) {
      router.replace('/(auth)/login')
      return
    }

    try {
      const [userProfile, profileStats] = await Promise.all([
        getUserProfile(user.uid),
        getProfileStats(user.uid),
      ])

      if (userProfile && userProfile.role === 'seller') {
        setProfile(userProfile as SellerProfile)
        setStats(profileStats)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSetting = async (setting: 'notifications' | 'lowStockAlerts') => {
  if (!auth.currentUser || !profile) return

  const currentSettings = profile.settings || {
    notifications: true,
    lowStockAlerts: true,
  }

  const newValue = !currentSettings[setting]
  
  try {
    await updateSellerSettings(auth.currentUser.uid, {
      ...currentSettings,
      [setting]: newValue,
    })
    
    setProfile({
      ...profile,
      settings: {
        ...currentSettings,
        [setting]: newValue,
      },
    })
  } catch (error) {
    console.error('Error updating setting:', error)
    Alert.alert('Error', 'Failed to update setting')
  }
}

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth)
            router.replace('/(auth)/login')
          } catch (error) {
            console.error('Logout error:', error)
            Alert.alert('Error', 'Failed to logout')
          }
        },
      },
    ])
  }

  if (loading || !profile || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Business Profile</Text>
        <Text style={styles.headerSubtitle}>Manage your cafe settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Business Card */}
        <View style={styles.businessCard}>
          <View style={styles.businessHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{profile.businessName.charAt(0).toUpperCase()}</Text>
              {/* <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View> */}
            </View>
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{profile.businessName}</Text>
              {/* <View style={styles.tierBadge}>
                <Text style={styles.tierText}>{profile.tier}</Text>
              </View> */}
              <View style={styles.infoRow}>
                <MapPin size={14} color={colors.textSoft} />
                <Text style={styles.infoText}>{profile.businessAddress}</Text>
              </View>
              <View style={styles.infoRow}>
                <Phone size={14} color={colors.textSoft} />
                <Text style={styles.infoText}>{profile.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Mail size={14} color={colors.textSoft} />
                <Text style={styles.infoText}>{profile.email}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/(seller)/sellereditprofile')}
            >
              <Edit2 size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

{/* Operating Hours */}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Operating Hours</Text>
    <TouchableOpacity>
      <Text style={styles.editLink}>Edit</Text>
    </TouchableOpacity>
  </View>
  <View style={styles.hoursCard}>
    <View style={styles.hourRow}>
      <Text style={styles.dayText}>Monday - Friday</Text>
      <Text style={styles.hourText}>
        {profile.operatingHours?.monday || '7:00 AM - 8:00 PM'}
      </Text>
    </View>
    <View style={styles.hourRow}>
      <Text style={styles.dayText}>Saturday</Text>
      <Text style={styles.hourText}>
        {profile.operatingHours?.saturday || '8:00 AM - 9:00 PM'}
      </Text>
    </View>
    <View style={styles.hourRow}>
      <Text style={styles.dayText}>Sunday</Text>
      <Text style={styles.hourText}>
        {profile.operatingHours?.sunday || '9:00 AM - 6:00 PM'}
      </Text>
    </View>
  </View>
</View>

        {/* Performance Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.miniStatCard}>
            <Text style={styles.statValue}>{stats.totalSales}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
          <View style={styles.miniStatCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.miniStatCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.savedPercentage}%</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        {/* Settings */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Settings</Text>
  <View style={styles.settingsCard}>
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: '#FFF5E6' }]}>
          <Bell size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.settingTitle}>Notifications</Text>
          <Text style={styles.settingSubtitle}>Order alerts and updates</Text>
        </View>
      </View>
      <Switch
        value={profile.settings?.notifications ?? true}
        onValueChange={() => handleToggleSetting('notifications')}
        trackColor={{ false: '#E5E5E5', true: colors.primary }}
        thumbColor="#fff"
      />
    </View>

    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: '#FFF5E6' }]}>
          <AlertCircle size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.settingTitle}>Low Stock Alerts</Text>
          <Text style={styles.settingSubtitle}>Get notified when inventory is low</Text>
        </View>
      </View>
      <Switch
        value={profile.settings?.lowStockAlerts ?? true}
        onValueChange={() => handleToggleSetting('lowStockAlerts')}
        trackColor={{ false: '#E5E5E5', true: colors.primary }}
        thumbColor="#fff"
      />
    </View>

            <TouchableOpacity style={styles.settingRowClickable}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F0F0' }]}>
                  <CreditCard size={20} color="#666" />
                </View>
                <View>
                  <Text style={styles.settingTitle}>Payment Settings</Text>
                  <Text style={styles.settingSubtitle}>Manage payout methods</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSoft} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRowClickable}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F0F0' }]}>
                  <BarChart3 size={20} color="#666" />
                </View>
                <View>
                  <Text style={styles.settingTitle}>Business Analytics</Text>
                  <Text style={styles.settingSubtitle}>Detailed reports and insights</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingRowClickable}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F0F0' }]}>
                  <Settings size={20} color="#666" />
                </View>
                <Text style={styles.settingTitle}>Account Settings</Text>
              </View>
              <ChevronRight size={20} color={colors.textSoft} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRowClickable}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#F0F0F0' }]}>
                  <HelpCircle size={20} color="#666" />
                </View>
                <Text style={styles.settingTitle}>Help & Support</Text>
              </View>
              <ChevronRight size={20} color={colors.textSoft} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRowClickable}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E7F1E5' }]}>
                  <Star size={20} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Subscription Plan</Text>
                </View>
              </View>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>Premium</Text>
              </View>
              <ChevronRight size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Your Impact */}
        <View style={styles.impactSection}>
          <View style={styles.impactHeader}>
            <View style={styles.impactIconContainer}>
              <Leaf size={24} color={colors.success} />
            </View>
            <View>
              <Text style={styles.impactTitle}>Your Impact</Text>
              <Text style={styles.impactSubtitle}>Making a difference</Text>
            </View>
          </View>

          <View style={styles.impactGrid}>
            <View style={styles.impactCard}>
              <Text style={styles.impactValue}>{stats.mealsSaved.toLocaleString()}</Text>
              <Text style={styles.impactLabel}>Meals Saved</Text>
            </View>
            <View style={styles.impactCard}>
              <Text style={styles.impactValue}>{stats.co2Reduced}T</Text>
              <Text style={styles.impactLabel}>CO₂ Reduced</Text>
            </View>
            <View style={styles.impactCard}>
              <Text style={styles.impactValue}>RM {(stats.revenueSaved / 1000).toFixed(1)}K</Text>
              <Text style={styles.impactLabel}>Revenue Saved</Text>
            </View>
            <View style={styles.impactCard}>
              <Text style={[styles.impactValue, { color: colors.error }]}>{stats.wasteDown}%</Text>
              <Text style={styles.impactLabel}>Waste Down</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>Version 1.0.0 • © 2026 Food Waste App</Text>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  businessCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  businessHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarText: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    fontSize: 24,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 56,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  verifiedIcon: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  editButton: {
    padding: 8,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  hoursCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayText: {
    fontSize: 14,
    color: colors.text,
  },
  hourText: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  miniStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingRowClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  premiumBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: spacing.sm,
  },
  premiumText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  impactSection: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  impactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  impactSubtitle: {
    fontSize: 13,
    color: colors.textSoft,
  },
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  impactCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  impactValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  footer: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})