import PrimaryButton from "@/src/components/PrimaryButton";
import { FieldError, FormSubmitError } from "@/src/components/FieldError";
import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import { useTheme } from "@/src/hooks/useTheme";
import {
    BuyerPreferences,
    getBuyerPreferences,
    updateBuyerPreferences,
} from "@/src/services/firebase/user";
import { colors as defaultColors, spacing } from "@/src/theme/styles";
import { BUYER_ROUTES, goBackToReturn } from "@/src/utils/navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin, Moon, Zap } from "lucide-react-native";
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
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.profile);
  const { isDarkMode, setIsDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<BuyerPreferences | null>(null);

  // State for preferences
  const [searchRadius, setSearchRadius] = useState("10");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [darkModeLocal, setDarkModeLocal] = useState(isDarkMode);
  const [errors, setErrors] = useState<{ searchRadius?: string; submit?: string }>({});

  const styles = getStyles(colors);

  useEffect(() => {
    if (authLoading) return;

    const fetchPreferences = async () => {
      try {
        if (!user?.uid) {
          // Signed out (e.g. logout while this screen is in the stack) — leave quietly.
          router.replace("/");
          return;
        }

        const prefs = await getBuyerPreferences(user.uid);
        if (prefs) {
          setPreferences(prefs);
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
  }, [user?.uid, authLoading]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const radius = parseInt(searchRadius);

      if (isNaN(radius) || radius < 1 || radius > 100) {
        setErrors({
          searchRadius: "Search radius must be between 1 and 100 km",
        });
        return;
      }

      setErrors({});
      if (user?.uid) {
        // Update dark mode immediately
        await setIsDarkMode(darkModeLocal);

        // Update preferences in Firebase
        await updateBuyerPreferences(user.uid, {
          searchRadius: radius,
          autoRefresh,
          darkMode: darkModeLocal,
        });

        Alert.alert("Success", "Preferences saved successfully", [
          {
            text: "OK",
            onPress: handleBack,
          },
        ]);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      setErrors({ submit: "Failed to save preferences. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleRadiusIncrease = () => {
    const current = parseInt(searchRadius) || 10;
    if (current < 100) {
      setSearchRadius((current + 5).toString());
      setErrors((prev) => ({ ...prev, searchRadius: undefined, submit: undefined }));
    }
  };

  const handleRadiusDecrease = () => {
    const current = parseInt(searchRadius) || 10;
    if (current > 1) {
      setSearchRadius((current - 5).toString());
      setErrors((prev) => ({ ...prev, searchRadius: undefined, submit: undefined }));
    }
  };

  if (loading || authLoading) {
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
            onPress={handleBack}
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
            <FieldError message={errors.searchRadius} />
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
          <FormSubmitError message={errors.submit} />
          <PrimaryButton
            title={saving ? "Saving..." : "Save Preferences"}
            onPress={handleSave}
            disabled={saving}
          />
          <PrimaryButton
            title="Cancel"
            onPress={handleBack}
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
