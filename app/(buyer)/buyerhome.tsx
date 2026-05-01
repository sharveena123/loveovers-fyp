import { Text, TextInput } from "@/src/components/StyledText";
import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { BuyerStats, getBuyerStats } from "@/src/services/firebase/buyerStats";
import { auth } from "@/src/services/firebase/config";
import { colors, spacing } from "@/src/theme/styles";
import {
  addRecentLocation,
  getPreferredLocation,
  getRecentLocations,
  savePreferredLocation,
} from "@/src/utils/locationPreference";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import {
  Clock,
  MapPin,
  Search,
  Star,
  TrendingDown,
  User,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type MapLocation = {
  latitude: number;
  longitude: number;
};

type LocationSuggestion = {
  label: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

const QUICK_CITY_LOCATIONS: LocationSuggestion[] = [
  { label: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869 },
  { label: "Petaling Jaya", latitude: 3.1073, longitude: 101.6067 },
  { label: "Shah Alam", latitude: 3.0738, longitude: 101.5183 },
  { label: "Subang Jaya", latitude: 3.0433, longitude: 101.5816 },
  { label: "George Town", latitude: 5.4141, longitude: 100.3288 },
];

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  (Constants.expoConfig?.extra?.googlePlacesApiKey as string | undefined) ||
  "";

const getDistanceKm = (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) => {
  const R = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function BuyerHome() {
  const [stats, setStats] = useState<BuyerStats | null>(null);
  const [bags, setBags] = useState<AvailableBag[]>([]);
  const [filteredBags, setFilteredBags] = useState<AvailableBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [settingLocation, setSettingLocation] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [recentLocations, setRecentLocations] = useState<LocationSuggestion[]>(
    [],
  );
  const [location, setLocation] = useState("Brickfields, KL");
  const [userLocation, setUserLocation] = useState<MapLocation>({
    latitude: 3.139,
    longitude: 101.6869,
  });
  const [headerSearchActive, setHeaderSearchActive] = useState(false);

  // 🔹 INITIALIZATION
  useEffect(() => {
    initApp();
  }, []);

  // 🔹 Reset header search when navigating back to this page
  useFocusEffect(
    useCallback(() => {
      setHeaderSearchActive(false);
      setLocationSearchQuery("");
      setLocationSuggestions([]);
    }, []),
  );

  const initApp = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    setLoading(true);
    try {
      const buyerStats = await getBuyerStats(user.uid);
      setStats(buyerStats);
      const recent = await getRecentLocations();
      setRecentLocations(recent);

      const preferredLocation = await getPreferredLocation();

      if (preferredLocation) {
        const selectedLocation: MapLocation = {
          latitude: preferredLocation.latitude,
          longitude: preferredLocation.longitude,
        };

        setLocation(preferredLocation.label);
        setUserLocation(selectedLocation);
        await loadBagsByLocation(selectedLocation);
      } else {
        const currentLocation = await getCurrentLocation();
        const label = await resolveLocationLabel(
          currentLocation,
          "Current location",
        );

        setLocation(label);
        setUserLocation(currentLocation);
        await savePreferredLocation({ ...currentLocation, label });
        await loadBagsByLocation(currentLocation);
      }
    } catch (error) {
      console.error("Error initializing app:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBagsByLocation = async (loc: MapLocation) => {
    const availableBags = await getAvailableBags(loc);

    const recalculated = availableBags
      .map((bag) => {
        const lat = Number(bag.latitude);
        const lng = Number(bag.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return bag;
        }

        return {
          ...bag,
          distance: getDistanceKm(loc.latitude, loc.longitude, lat, lng),
        };
      })
      .sort((a, b) => a.distance - b.distance);

    setBags(recalculated);
    setFilteredBags(recalculated);
  };

  const persistRecent = async (entry: {
    latitude: number;
    longitude: number;
    label: string;
  }) => {
    const next = await addRecentLocation(entry);
    setRecentLocations(next);
  };

  useEffect(() => {
    const query = locationSearchQuery.trim();

    if (query.length < 3) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setSearchingLocation(true);

      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
              "X-Goog-FieldMask":
                "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
            },
            body: JSON.stringify({
              input: query,
              languageCode: "en",
              includedRegionCodes: ["MY"],
              locationBias: {
                circle: {
                  center: {
                    latitude: 3.139,
                    longitude: 101.6869,
                  },
                  radius: 50000,
                },
              },
            }),
          },
        );

        const payloadText = await response.text();
        const data = payloadText
          ? (JSON.parse(payloadText) as {
              suggestions?: {
                placePrediction?: {
                  placeId?: string;
                  text?: { text?: string } | string;
                };
              }[];
              error?: { message?: string };
            })
          : {};

        if (!response.ok) {
          throw new Error(
            data.error?.message ||
              `Places autocomplete failed (${response.status})`,
          );
        }

        if (data.error?.message) {
          throw new Error(data.error.message);
        }

        if (cancelled) return;

        const parsed = (data.suggestions || [])
          .map((item) => {
            const prediction = item.placePrediction;
            const textValue = prediction?.text;
            return {
              label:
                typeof textValue === "string"
                  ? textValue
                  : textValue?.text || "",
              placeId: prediction?.placeId,
            };
          })
          .filter((item) => item.label.length > 0 && !!item.placeId);

        setLocationSuggestions(parsed);
      } catch (error) {
        if (!cancelled) {
          console.error("Location search failed:", error);
          setLocationSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearchingLocation(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [locationSearchQuery]);

  const fetchGooglePlaceCoordinates = async (
    placeId: string,
  ): Promise<MapLocation | null> => {
    if (!GOOGLE_PLACES_API_KEY) return null;

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "location,displayName",
        },
      },
    );

    const payloadText = await response.text();
    const data = payloadText
      ? (JSON.parse(payloadText) as {
          location?: { latitude?: number; longitude?: number };
          error?: { message?: string };
        })
      : {};

    if (!response.ok) {
      throw new Error(
        data.error?.message || `Place details failed (${response.status})`,
      );
    }

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const point = data.location;
    if (!point) return null;

    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      return null;
    }

    return {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    };
  };

  const applySelectedLocation = async (selection: LocationSuggestion) => {
    let selectedLocation: MapLocation | null = null;

    if (
      Number.isFinite(selection.latitude) &&
      Number.isFinite(selection.longitude)
    ) {
      selectedLocation = {
        latitude: Number(selection.latitude),
        longitude: Number(selection.longitude),
      };
    } else if (selection.placeId) {
      selectedLocation = await fetchGooglePlaceCoordinates(selection.placeId);
    }

    if (!selectedLocation) {
      throw new Error("Unable to resolve selected location coordinates");
    }

    setLocation(selection.label);
    setUserLocation(selectedLocation);
    await savePreferredLocation({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      label: selection.label,
    });
    await persistRecent({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      label: selection.label,
    });

    await loadBagsByLocation(selectedLocation);

    setLocationSearchQuery(selection.label);
    setLocationSuggestions([]);
  };

  const getCurrentLocation = async (): Promise<MapLocation> => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      console.log("Permission denied, using fallback location");
      return { latitude: 3.139, longitude: 101.6869 };
    }

    const loc = await Location.getCurrentPositionAsync({});
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const resolveLocationLabel = async (
    loc: MapLocation,
    fallbackLabel: string,
  ): Promise<string> => {
    try {
      const address = await Location.reverseGeocodeAsync(loc);
      if (!address.length) return fallbackLabel;

      const place = address[0];
      const parts = [place.district, place.city].filter(Boolean);

      return parts.length > 0 ? parts.join(", ") : fallbackLabel;
    } catch {
      return fallbackLabel;
    }
  };

  const handleSetLocationFromSearch = async () => {
    const query = locationSearchQuery.trim();
    if (!query) {
      Alert.alert("Missing location", "Enter a place to search first.");
      return;
    }

    setSettingLocation(true);
    try {
      if (locationSuggestions.length > 0) {
        await applySelectedLocation(locationSuggestions[0]);
      } else {
        const geocoded = await Location.geocodeAsync(query);
        if (!geocoded.length) {
          Alert.alert("Location not found", "Try a more specific place name.");
          return;
        }

        await applySelectedLocation({
          label: query,
          latitude: geocoded[0].latitude,
          longitude: geocoded[0].longitude,
        });
      }
    } catch (error) {
      console.error("Error setting searched location:", error);
      Alert.alert("Unable to set location", "Please try again in a moment.");
    } finally {
      setSettingLocation(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setSettingLocation(true);
    try {
      const currentLocation = await getCurrentLocation();
      const label = await resolveLocationLabel(
        currentLocation,
        "Current location",
      );

      setLocation(label);
      setUserLocation(currentLocation);
      await savePreferredLocation({ ...currentLocation, label });
      await persistRecent({ ...currentLocation, label });
      await loadBagsByLocation(currentLocation);
      setLocationSearchQuery(label);
      setLocationSuggestions([]);
    } catch (error) {
      console.error("Error refreshing current location:", error);
      Alert.alert(
        "Unable to refresh location",
        "Please try again in a moment.",
      );
    } finally {
      setSettingLocation(false);
    }
  };

  // 🔹 FILTER SEARCH
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBags(bags);
      return;
    }

    const filtered = bags.filter(
      (bag) =>
        bag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bag.sellerName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredBags(filtered);
  }, [bags, searchQuery]);

  const calculateDiscount = (original: number, discounted: number) =>
    Math.round(((original - discounted) / original) * 100);

  const formatTime = (timeString: string) => timeString || "N/A";
  const getLeftCount = (item: AvailableBag) => item.quantity - (item.sold || 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 200 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.locationLabel}>Location</Text>
          {!headerSearchActive ? (
            <TouchableOpacity
              style={styles.locationRow}
              onPress={() => setHeaderSearchActive(true)}
            >
              <MapPin size={20} color={colors.white} />
              <Text
                style={styles.locationText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {location}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerLocationInputRow}>
              <MapPin size={18} color={colors.white} />
              <TextInput
                style={styles.headerLocationInput}
                placeholder="Search location..."
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
                placeholderTextColor="rgba(255, 255, 255, 0.7)"
                autoFocus
              />
              {locationSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setLocationSearchQuery("");
                    setLocationSuggestions([]);
                  }}
                >
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <User size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Location Suggestions Dropdown */}
      {headerSearchActive && (
        <View style={styles.headerSuggestionsContainer}>
          {recentLocations.length > 0 &&
            locationSearchQuery.trim().length < 3 && (
              <View style={styles.headerRecentSection}>
                <Text style={styles.headerRecentTitle}>Recent</Text>
                {recentLocations.map((recent, index) => (
                  <TouchableOpacity
                    key={`${recent.label}-${index}`}
                    style={styles.headerSuggestionItem}
                    onPress={() => {
                      applySelectedLocation(recent);
                      setHeaderSearchActive(false);
                    }}
                    disabled={settingLocation}
                  >
                    <MapPin size={14} color={colors.textSoft} />
                    <Text
                      style={styles.headerSuggestionText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {recent.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          {searchingLocation ? (
            <Text style={styles.headerLocationHint}>Searching...</Text>
          ) : locationSuggestions.length > 0 ? (
            <View>
              {locationSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`${suggestion.label}-${index}`}
                  style={styles.headerSuggestionItem}
                  onPress={() => {
                    applySelectedLocation(suggestion);
                    setHeaderSearchActive(false);
                  }}
                  disabled={settingLocation}
                >
                  <MapPin size={14} color={colors.textSoft} />
                  <Text
                    style={styles.headerSuggestionText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {suggestion.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {!searchingLocation &&
            locationSearchQuery.trim().length > 0 &&
            locationSuggestions.length === 0 && (
              <TouchableOpacity
                style={styles.headerSuggestionItem}
                onPress={() => {
                  handleSetLocationFromSearch();
                  setHeaderSearchActive(false);
                }}
              >
                <Search size={14} color={colors.textSoft} />
                <Text style={styles.headerSuggestionText}>
                  Search &quot;{locationSearchQuery}&quot;
                </Text>
              </TouchableOpacity>
            )}

          <TouchableOpacity
            style={styles.headerCloseButton}
            onPress={() => {
              setHeaderSearchActive(false);
              setLocationSearchQuery("");
              setLocationSuggestions([]);
            }}
          >
            <Text style={styles.headerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textSoft} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cafes, bakeries..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSoft}
          />
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats?.bagsSaved || 0}</Text>
            <Text style={styles.statLabel}>Bags Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              RM {stats?.moneySaved.toFixed(0) || 0}
            </Text>
            <Text style={styles.statLabel}>Money Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats?.co2Saved || 0} kg</Text>
            <Text style={styles.statLabel}>CO₂ Saved</Text>
          </View>
        </View>

        {/* Available Near You */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Near You</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {filteredBags.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No bags available nearby</Text>
              <Text style={styles.emptySubtext}>
                Check back later for new listings!
              </Text>
            </View>
          ) : (
            filteredBags.map((bag, index) => {
              const leftCount = getLeftCount(bag);
              const discount = calculateDiscount(
                bag.originalPrice || bag.price,
                bag.discountedPrice || bag.price,
              );
              const lat = Number(bag.latitude);
              const lng = Number(bag.longitude);
              const computedDistance =
                Number.isFinite(lat) && Number.isFinite(lng)
                  ? getDistanceKm(
                      userLocation.latitude,
                      userLocation.longitude,
                      lat,
                      lng,
                    )
                  : bag.distance;

              return (
                <TouchableOpacity
                  key={bag.id || index}
                  style={styles.bagCard}
                  onPress={() => {
                    // Route to appropriate detail page based on type
                    if (bag.type === "bag") {
                      router.push({
                        pathname: "/(buyer)/mysterydetail/[id]",
                        params: { id: bag.id },
                      } as any);
                    } else {
                      router.push({
                        pathname: "/(buyer)/itemdetail/[id]",
                        params: { id: bag.id },
                      } as any);
                    }
                  }}
                >
                  <View style={styles.bagImageContainer}>
                    {bag.imageUrl ? (
                      <Image
                        source={{ uri: bag.imageUrl }}
                        style={styles.bagImage}
                      />
                    ) : (
                      <View style={styles.bagImagePlaceholder}>
                        <Text style={styles.bagImagePlaceholderText}>
                          {bag.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {discount > 0 && (
                      <View style={styles.discountBadge}>
                        <TrendingDown size={12} color={colors.white} />
                        <Text style={styles.discountText}>-{discount}%</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.bagInfo}>
                    <Text style={styles.bagName}>{bag.name}</Text>
                    <Text style={styles.shopName}>{bag.sellerName}</Text>

                    <View style={styles.bagMeta}>
                      <Star size={14} color="#FFC107" fill="#FFC107" />
                      <Text style={styles.ratingText}>
                        {bag.rating.toFixed(1)}
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <MapPin size={14} color={colors.textSoft} />
                      <Text style={styles.distanceText}>
                        {computedDistance.toFixed(1)} km
                      </Text>
                    </View>

                    <View style={styles.bagTime}>
                      <Clock size={14} color={colors.textSoft} />
                      <Text style={styles.timeText}>
                        {formatTime(bag.expiryDate)}
                      </Text>
                    </View>

                    <View style={styles.bagFooter}>
                      <View>
                        <Text style={styles.price}>
                          RM {(bag.discountedPrice || bag.price).toFixed(2)}
                        </Text>
                        {bag.originalPrice &&
                          bag.originalPrice >
                            (bag.discountedPrice || bag.price) && (
                            <Text style={styles.originalPrice}>
                              RM {bag.originalPrice.toFixed(2)}
                            </Text>
                          )}
                      </View>
                      <View style={styles.leftBadge}>
                        <Text style={styles.leftText}>{leftCount} left</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Impact Card */}
        <View style={styles.impactCard}>
          <View style={styles.impactIcon}>
            <Text style={styles.impactEmoji}>📊</Text>
          </View>
          <View style={styles.impactContent}>
            <Text style={styles.impactTitle}>Your Impact This Month</Text>
            <Text style={styles.impactText}>
              You&apos;ve saved {stats?.bagsSaved || 0} meals from going to
              waste and prevented {stats?.co2Saved || 0}kg of CO₂ emissions!
            </Text>
            <TouchableOpacity style={styles.detailsButton}>
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  locationLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  locationText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.white,
    flex: 1,
    minWidth: 0,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerLocationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerLocationInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
  },
  headerSuggestionsContainer: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 300,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headerRecentSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRecentTitle: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  headerSuggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSuggestionText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  headerLocationHint: {
    fontSize: 13,
    color: colors.textSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerCloseButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headerCloseText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
    textAlign: "center",
  },
  locationAdjustCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  quickCitiesRow: {
    gap: spacing.sm,
    paddingBottom: 2,
  },
  quickCityChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  quickCityText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  clearInputButton: {
    padding: 4,
  },
  recentSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  recentTitle: {
    fontSize: 12,
    color: colors.textSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  locationActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  locationHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  suggestionsList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.text,
  },
  locationActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  locationGhostButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationGhostText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  statsCard: {
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: "rgba(255, 255, 255, 0.9)" },
  statDivider: { width: 1, backgroundColor: "rgba(255, 255, 255, 0.3)" },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: colors.text },
  viewAllText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
  },
  bagImageContainer: { width: 120, height: 140, position: "relative" },
  bagImage: { width: "100%", height: "100%" },
  bagImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  bagImagePlaceholderText: {
    fontSize: 48,
    fontWeight: "600",
    color: colors.primary,
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discountText: { fontSize: 12, fontWeight: "600", color: colors.white },
  bagInfo: { flex: 1, padding: spacing.md, justifyContent: "space-between" },
  bagName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  shopName: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: 6,
  },
  bagMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  ratingText: { fontSize: 13, color: colors.text, fontWeight: "500" },
  metaDot: { fontSize: 13, color: colors.textSoft },
  distanceText: { fontSize: 13, color: colors.textSoft },
  bagTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  timeText: { fontSize: 13, color: colors.textSoft },
  bagFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  price: { fontSize: 20, fontWeight: "700", color: colors.primary },
  originalPrice: {
    fontSize: 13,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  leftBadge: {
    backgroundColor: colors.errorSoft,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.error,
  },
  leftText: { fontSize: 12, fontWeight: "600", color: colors.error },
  impactCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  impactIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
  impactEmoji: { fontSize: 28 },
  impactContent: { flex: 1 },
  impactTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  impactText: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  detailsButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  detailsButtonText: { fontSize: 13, fontWeight: "600", color: colors.text },
  emptyState: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtext: { fontSize: 14, color: colors.textSoft },
});
