import PrimaryButton from "@/src/components/PrimaryButton";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import { useTheme } from "@/src/hooks/useTheme";
import {
    BuyerPreferences,
    getBuyerPreferences,
    updateBuyerPreferences,
} from "@/src/services/firebase/user";
import { colors as defaultColors, spacing } from "@/src/theme/styles";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, MapPin, Moon, Zap } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from "react-native";

export default function BuyerPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode, setIsDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<BuyerPreferences | null>(null);

  // State for preferences
  const [pushNotifications, setPushNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [searchRadius, setSearchRadius] = useState("10");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [darkModeLocal, setDarkModeLocal] = useState(isDarkMode);

  const styles = getStyles(colors);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        if (!user?.uid) {
          Alert.alert("Error", "User not authenticated");
          router.back();
          return;
        }

        const prefs = await getBuyerPreferences(user.uid);
        if (prefs) {
          setPreferences(prefs);
          setPushNotifications(prefs.pushNotifications);
          setEmailNotifications(prefs.emailNotifications);
          setSearchRadius(prefs.searchRadius.toString());
          setAutoRefresh(prefs.autoRefresh);
          setDarkModeLocal(prefs.darkMode);
        }
      } catch (error) {
        console.error("Error fetching preferences:", error);
        Alert.alert("Error", "Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user?.uid]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const radius = parseInt(searchRadius);

      if (isNaN(radius) || radius < 1 || radius > 100) {
        Alert.alert("Validation", "Search radius must be between 1 and 100 km");
        return;
      }

      if (user?.uid) {
        // Update dark mode immediately
        await setIsDarkMode(darkModeLocal);

        // Update preferences in Firebase
        await updateBuyerPreferences(user.uid, {
          pushNotifications,
          emailNotifications,
          searchRadius: radius,
          autoRefresh,
          darkMode: darkModeLocal,
        });

        Alert.alert("Success", "Preferences saved successfully", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      Alert.alert("Error", "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleRadiusIncrease = () => {
    const current = parseInt(searchRadius) || 10;
    if (current < 100) {
      setSearchRadius((current + 5).toString());
    }
  };

  const handleRadiusDecrease = () => {
    const current = parseInt(searchRadius) || 10;
    if (current > 1) {
      setSearchRadius((current - 5).toString());
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.buttonText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.buttonText }]}>
            Preferences
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Preferences Sections */}
        <View style={styles.preferencesContainer}>
          {/* Notifications Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Notifications</Text>
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLabel}>
                <Text style={styles.label}>Push Notifications</Text>
                <Text style={styles.description}>
                  Receive alerts about deals and orders
                </Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: "#ccc", true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLabel}>
                <Text style={styles.label}>Email Notifications</Text>
                <Text style={styles.description}>
                  Receive updates via email
                </Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: "#ccc", true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* Search Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Search Settings</Text>
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLabel}>
                <Text style={styles.label}>Search Radius</Text>
                <Text style={styles.description}>
                  {searchRadius} km from your location
                </Text>
              </View>
            </View>

            <View style={styles.radiusControls}>
              <TouchableOpacity
                style={styles.radiusButton}
                onPress={handleRadiusDecrease}
              >
                <Text style={styles.radiusButtonText}>−</Text>
              </TouchableOpacity>

              <View style={styles.radiusDisplay}>
                <Text style={styles.radiusValue}>{searchRadius}</Text>
                <Text style={styles.radiusUnit}>km</Text>
              </View>

              <TouchableOpacity
                style={styles.radiusButton}
                onPress={handleRadiusIncrease}
              >
                <Text style={styles.radiusButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* App Preferences Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Zap size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>App Settings</Text>
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLabel}>
                <Text style={styles.label}>Auto Refresh</Text>
                <Text style={styles.description}>
                  Automatically refresh product listings
                </Text>
              </View>
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
                trackColor={{ false: "#ccc", true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* Display Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Moon size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Display</Text>
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLabel}>
                <Text style={styles.label}>Dark Mode</Text>
                <Text style={styles.description}>
                  Enable dark mode for the app
                </Text>
              </View>
              <Switch
                value={darkModeLocal}
                onValueChange={setDarkModeLocal}
                trackColor={{ false: "#ccc", true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={saving ? "Saving..." : "Save Preferences"}
            onPress={handleSave}
            disabled={saving}
          />
          <PrimaryButton
            title="Cancel"
            onPress={() => router.back()}
            variant="outlined"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: typeof defaultColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backButton: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
    },
    preferencesContainer: {
      padding: spacing.lg,
    },
    section: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginLeft: spacing.md,
    },
    preferenceItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    preferenceItem_lastChild: {
      borderBottomWidth: 0,
    },
    preferenceLabel: {
      flex: 1,
      marginRight: spacing.md,
    },
    label: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
      marginBottom: spacing.xs,
    },
    description: {
      fontSize: 12,
      color: colors.textSoft,
    },
    radiusControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
    },
    radiusButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: spacing.md,
    },
    radiusButtonText: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.white,
    },
    radiusDisplay: {
      alignItems: "center",
      minWidth: 80,
    },
    radiusValue: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.primary,
    },
    radiusUnit: {
      fontSize: 12,
      color: colors.textSoft,
      marginTop: spacing.xs,
    },
    buttonContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
  });
