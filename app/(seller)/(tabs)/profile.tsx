import { Text } from "@/src/components/StyledText";
import { auth } from "@/src/services/firebase/config";
import { getProfileStats, ProfileStats } from "@/src/services/firebase/profile";
import {
  getUserProfile,
  SellerProfile,
  updateSellerSettings,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { router, useFocusEffect } from "expo-router";
import { signOut } from "firebase/auth";
import {
  AlertCircle,
  BarChart3,
  Bell,
  ChevronRight,
  Clock,
  CreditCard,
  Edit2,
  HelpCircle,
  Leaf,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  Settings,
  Star,
  Store,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

function MenuRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.menuRowLeft}>
        <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.menuRowRight}>
        {rightElement}
        {showChevron && onPress ? (
          <ChevronRight size={20} color={colors.textSoft} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function StatPill({
  icon,
  iconBg,
  value,
  label,
  valueColor,
  accentColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  valueColor?: string;
  accentColor: string;
}) {
  return (
    <View style={[styles.statPill, { borderTopColor: accentColor }]}>
      <View style={[styles.statPillIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[styles.statPillValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    try {
      const [userProfile, profileStats] = await Promise.all([
        getUserProfile(user.uid),
        getProfileStats(user.uid),
      ]);

      if (userProfile && userProfile.role === "seller") {
        setProfile(userProfile as SellerProfile);
        setStats(profileStats);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleToggleSetting = async (
    setting: "notifications" | "lowStockAlerts",
  ) => {
    if (!auth.currentUser || !profile) return;

    const currentSettings = profile.settings || {
      notifications: true,
      lowStockAlerts: true,
    };

    const newValue = !currentSettings[setting];

    try {
      await updateSellerSettings(auth.currentUser.uid, {
        ...currentSettings,
        [setting]: newValue,
      });

      setProfile({
        ...profile,
        settings: {
          ...currentSettings,
          [setting]: newValue,
        },
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      Alert.alert("Error", "Failed to update setting");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/(auth)/login");
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  if (loading || !profile || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hours = [
    { day: "Mon – Fri", time: profile.operatingHours?.monday || "7:00 AM – 8:00 PM" },
    { day: "Saturday", time: profile.operatingHours?.saturday || "8:00 AM – 9:00 PM" },
    { day: "Sunday", time: profile.operatingHours?.sunday || "9:00 AM – 6:00 PM" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerDecor} />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your business</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Business card */}
          <View style={styles.businessCard}>
            <View style={styles.businessCardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.businessName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.businessMeta}>
                <View style={styles.businessNameRow}>
                  <Text style={styles.businessName} numberOfLines={1}>
                    {profile.businessName}
                  </Text>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => router.push("/(seller)/sellereditprofile")}
                  >
                    <Edit2 size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.storeBadge}>
                  <Store size={12} color={colors.primary} />
                  <Text style={styles.storeBadgeText}>Seller account</Text>
                </View>
              </View>
            </View>

            <View style={styles.contactList}>
              <View style={styles.contactRow}>
                <MapPin size={15} color={colors.primary} />
                <Text style={styles.contactText} numberOfLines={2}>
                  {profile.businessAddress || "No address set"}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <Phone size={15} color={colors.primary} />
                <Text style={styles.contactText}>{profile.phone}</Text>
              </View>
              <View style={styles.contactRow}>
                <Mail size={15} color={colors.primary} />
                <Text style={styles.contactText}>{profile.email}</Text>
              </View>
            </View>
          </View>

          {/* Performance stats */}
          <Text style={styles.sectionLabel}>Performance</Text>
          <View style={styles.statsRow}>
            <StatPill
              icon={<Package size={18} color={colors.primary} />}
              iconBg={colors.primarySoft}
              value={String(stats.totalSales)}
              label="Total sales"
              accentColor={colors.primary}
            />
            <StatPill
              icon={<Star size={18} color="#c4a574" />}
              iconBg="#f5f0e8"
              value={stats.rating.toFixed(1)}
              label="Rating"
              valueColor={colors.primary}
              accentColor="#c4a574"
            />
            <StatPill
              icon={<Leaf size={18} color={colors.success} />}
              iconBg={colors.successSoft}
              value={`${stats.savedPercentage}%`}
              label="Saved"
              valueColor={colors.success}
              accentColor={colors.success}
            />
          </View>

          {/* Operating hours */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Operating hours</Text>
              <TouchableOpacity
                onPress={() => router.push("/(seller)/sellereditprofile")}
              >
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {hours.map((row, i) => (
                <View
                  key={row.day}
                  style={[
                    styles.hourRow,
                    i < hours.length - 1 && styles.hourRowBorder,
                  ]}
                >
                  <View style={styles.hourDayWrap}>
                    <Clock size={14} color={colors.textSoft} />
                    <Text style={styles.dayText}>{row.day}</Text>
                  </View>
                  <Text style={styles.hourText}>{row.time}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.card}>
              <MenuRow
                icon={<Bell size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Notifications"
                subtitle="Order alerts and updates"
                showChevron={false}
                rightElement={
                  <Switch
                    value={profile.settings?.notifications ?? true}
                    onValueChange={() => handleToggleSetting("notifications")}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                }
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<AlertCircle size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Low stock alerts"
                subtitle="When inventory is running low"
                showChevron={false}
                rightElement={
                  <Switch
                    value={profile.settings?.lowStockAlerts ?? true}
                    onValueChange={() => handleToggleSetting("lowStockAlerts")}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                }
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<CreditCard size={20} color="#666" />}
                iconBg="#f0f0f0"
                title="Payment settings"
                subtitle="Manage payout methods"
                onPress={() =>
                  Alert.alert("Coming soon", "Payment settings will be available soon.")
                }
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<BarChart3 size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Business analytics"
                subtitle="Reports and insights"
                onPress={() => router.push("/(seller)/analytics")}
              />
            </View>
          </View>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <MenuRow
                icon={<Settings size={20} color="#666" />}
                iconBg="#f0f0f0"
                title="Account settings"
                onPress={() => router.push("/(seller)/sellereditprofile")}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<HelpCircle size={20} color={colors.primary} />}
                iconBg={colors.primarySoft}
                title="Help & support"
                onPress={() => router.push("/(seller)/support")}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={<Star size={20} color={colors.success} />}
                iconBg={colors.successSoft}
                title="Subscription plan"
                showChevron={false}
                rightElement={
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                }
              />
            </View>
          </View>

          {/* Impact */}
          <View style={styles.impactCard}>
            <View style={styles.impactHeader}>
              <View style={styles.impactIconWrap}>
                <Leaf size={22} color={colors.success} />
              </View>
              <View>
                <Text style={styles.impactTitle}>Your impact</Text>
                <Text style={styles.impactSubtitle}>
                  The difference you&apos;re making
                </Text>
              </View>
            </View>
            <View style={styles.impactGrid}>
              <View style={styles.impactItem}>
                <Text style={styles.impactValue}>
                  {stats.mealsSaved.toLocaleString()}
                </Text>
                <Text style={styles.impactLabel}>Meals saved</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={styles.impactValue}>{stats.co2Reduced}T</Text>
                <Text style={styles.impactLabel}>CO₂ reduced</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={styles.impactValue}>
                  RM {(stats.revenueSaved / 1000).toFixed(1)}K
                </Text>
                <Text style={styles.impactLabel}>Revenue saved</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={[styles.impactValue, { color: colors.success }]}>
                  {stats.wasteDown}%
                </Text>
                <Text style={styles.impactLabel}>Waste down</Text>
              </View>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.88}
          >
            <LogOut size={20} color={colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>Version 1.0.0 · © 2026 LoveOvers</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSoft,
    fontWeight: "500",
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerContent: {
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  body: {
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  businessCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(106, 60, 0, 0.08)",
  },
  businessCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.white,
  },
  businessMeta: {
    flex: 1,
    minWidth: 0,
  },
  businessNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 6,
  },
  businessName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    flex: 1,
    letterSpacing: -0.3,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  storeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  storeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  contactList: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSoft,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: "center",
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  statPillLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  editLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  hourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  hourRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hourDayWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  hourText: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: "500",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  menuRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 42 + spacing.md,
  },
  premiumBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  impactCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(143, 151, 121, 0.25)",
  },
  impactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  impactIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  impactSubtitle: {
    fontSize: 13,
    color: colors.textSoft,
    marginTop: 2,
  },
  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  impactItem: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "center",
  },
  impactValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
    textAlign: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.errorSoft,
    marginBottom: spacing.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.error,
  },
  footer: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
