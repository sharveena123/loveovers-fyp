import { Text, TextInput } from "@/src/components/StyledText";
import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import type { ItemCategory } from "@/src/services/firebase/inventoryServices";
import { BuyerStats, getBuyerStats } from "@/src/services/firebase/buyerStats";
import { auth } from "@/src/services/firebase/config";
import {
  BuyerProfile,
  getUserProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { formatCo2, formatMeals } from "@/src/utils/impactMetrics";
import { BUYER_ROUTES, pushWithReturn } from "@/src/utils/navigation";
import {
  addRecentLocation,
  getPreferredLocation,
  getRecentLocations,
  savePreferredLocation,
} from "@/src/utils/locationPreference";
import { resolveBuyerPriceDisplay } from "@/src/utils/listingPrices";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingDown,
  User,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type FilterKey = "all" | "mystery" | "items" | "deals";
type PriceRangeKey = "any" | "under10" | "10-20" | "20-30" | "over30";
type SortKey = "distance" | "price_asc" | "price_desc" | "discount";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mystery", label: "Mystery bags" },
  { key: "items", label: "Items" },
  { key: "deals", label: "Best deals" },
];

const CATEGORY_OPTIONS: { key: ItemCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Bakery", label: "Bakery" },
  { key: "Pastries", label: "Pastries" },
  { key: "Bread", label: "Bread" },
  { key: "Desserts", label: "Desserts" },
  { key: "Meals", label: "Meals" },
  { key: "Beverages", label: "Beverages" },
  { key: "Other", label: "Other" },
];

const PRICE_RANGES: { key: PriceRangeKey; label: string }[] = [
  { key: "any", label: "Any price" },
  { key: "under10", label: "Under RM10" },
  { key: "10-20", label: "RM10–20" },
  { key: "20-30", label: "RM20–30" },
  { key: "over30", label: "RM30+" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "distance", label: "Nearest" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "discount", label: "Top discount" },
];

const getBagPrice = (bag: AvailableBag) =>
  resolveBuyerPriceDisplay(bag).salePrice;

const getDiscountPct = (bag: AvailableBag) =>
  resolveBuyerPriceDisplay(bag).discountPct;

const matchesPriceRange = (bag: AvailableBag, range: PriceRangeKey) => {
  const price = getBagPrice(bag);
  switch (range) {
    case "under10":
      return price < 10;
    case "10-20":
      return price >= 10 && price < 20;
    case "20-30":
      return price >= 20 && price < 30;
    case "over30":
      return price >= 30;
    default:
      return true;
  }
};

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[filterStyles.chip, active && filterStyles.chipActive]}
    >
      <Text style={[filterStyles.chipText, active && filterStyles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const filterStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSoft,
  },
  chipTextActive: {
    color: colors.white,
  },
});

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | "all">(
    "all",
  );
  const [priceRange, setPriceRange] = useState<PriceRangeKey>("any");
  const [sortBy, setSortBy] = useState<SortKey>("distance");
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
  const [refreshing, setRefreshing] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

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
      const [buyerStats, profile] = await Promise.all([
        getBuyerStats(user.uid),
        getUserProfile(user.uid),
      ]);
      setStats(buyerStats);
      if (profile && profile.role === "buyer") {
        setBuyerName((profile as BuyerProfile).fullName.split(" ")[0] || "");
      }
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

  const loadBagsByLocation = async (loc: MapLocation, label?: string) => {
    const availableBags = await getAvailableBags({
      ...loc,
      locationLabel: label ?? location,
    });

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

  const formatTime = (timeString: string) => timeString || "N/A";
  const getLeftCount = (item: AvailableBag) => item.quantity - (item.sold || 0);

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (selectedCategory !== "all") n += 1;
    if (priceRange !== "any") n += 1;
    if (sortBy !== "distance") n += 1;
    return n;
  }, [selectedCategory, priceRange, sortBy]);

  const clearAdvancedFilters = () => {
    setSelectedCategory("all");
    setPriceRange("any");
    setSortBy("distance");
  };

  const displayBags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = bags.filter((bag) => {
      if (q) {
        const matchesSearch =
          bag.name.toLowerCase().includes(q) ||
          bag.sellerName.toLowerCase().includes(q) ||
          String(bag.category || "")
            .toLowerCase()
            .includes(q);
        if (!matchesSearch) return false;
      }

      if (selectedCategory !== "all" && bag.category !== selectedCategory) {
        return false;
      }
      if (!matchesPriceRange(bag, priceRange)) return false;

      if (activeFilter === "mystery" && bag.type !== "bag") return false;
      if (activeFilter === "items" && bag.type === "bag") return false;
      if (activeFilter === "deals" && getDiscountPct(bag) <= 0) return false;

      return true;
    });

    const effectiveSort =
      activeFilter === "deals" ? "discount" : sortBy;

    if (effectiveSort === "discount") {
      list = [...list].sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
    } else if (effectiveSort === "price_asc") {
      list = [...list].sort((a, b) => getBagPrice(a) - getBagPrice(b));
    } else if (effectiveSort === "price_desc") {
      list = [...list].sort((a, b) => getBagPrice(b) - getBagPrice(a));
    } else {
      list = [...list].sort((a, b) => a.distance - b.distance);
    }

    return list;
  }, [
    bags,
    searchQuery,
    selectedCategory,
    priceRange,
    activeFilter,
    sortBy,
  ]);

  const endingSoonBags = useMemo(
    () =>
      displayBags
        .filter((b) => getLeftCount(b) <= 3)
        .slice(0, 10),
    [displayBags],
  );

  const bestDeal = useMemo(() => {
    if (!displayBags.length) return null;
    return [...displayBags].sort(
      (a, b) => getDiscountPct(b) - getDiscountPct(a),
    )[0];
  }, [displayBags]);

  const lowestPrice = useMemo(() => {
    if (!displayBags.length) return null;
    return Math.min(...displayBags.map((b) => getBagPrice(b)));
  }, [displayBags]);

  const navigateToBag = (bag: AvailableBag) => {
    if (bag.type === "bag") {
      pushWithReturn(
        router,
        "/(buyer)/mysterydetail/[id]",
        BUYER_ROUTES.home,
        { id: bag.id ?? "" },
      );
    } else {
      pushWithReturn(
        router,
        "/(buyer)/itemdetail/[id]",
        BUYER_ROUTES.home,
        { id: bag.id ?? "" },
      );
    }
  };

  const renderBagCard = (bag: AvailableBag, index: number, compact = false) => {
    const leftCount = getLeftCount(bag);
    const prices = resolveBuyerPriceDisplay(bag);
    const discount = prices.discountPct;
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
    const isMystery = bag.type === "bag";

    if (compact) {
      return (
        <TouchableOpacity
          key={bag.id || `compact-${index}`}
          style={styles.compactCard}
          activeOpacity={0.92}
          onPress={() => navigateToBag(bag)}
        >
          <View style={styles.compactImageWrap}>
            {bag.imageUrl ? (
              <Image source={{ uri: bag.imageUrl }} style={styles.compactImage} />
            ) : (
              <View style={styles.compactPlaceholder}>
                <ShoppingBag size={24} color={colors.primary} />
              </View>
            )}
            {discount > 0 && (
              <View style={styles.compactDiscount}>
                <Text style={styles.compactDiscountText}>-{discount}%</Text>
              </View>
            )}
          </View>
          <Text style={styles.compactName} numberOfLines={2}>
            {bag.name}
          </Text>
          <Text style={styles.compactShop} numberOfLines={1}>
            {bag.sellerName}
          </Text>
          <View style={styles.compactFooter}>
            <Text style={styles.compactPrice}>
              RM {prices.salePrice.toFixed(2)}
            </Text>
            <View style={styles.compactUrgent}>
              <Flame size={11} color={colors.error} />
              <Text style={styles.compactUrgentText}>{leftCount} left</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={bag.id || index}
        style={styles.bagCard}
        activeOpacity={0.92}
        onPress={() => navigateToBag(bag)}
      >
        <View style={styles.bagImageWrap}>
          {bag.imageUrl ? (
            <Image source={{ uri: bag.imageUrl }} style={styles.bagImage} />
          ) : (
            <View style={styles.bagImagePlaceholder}>
              <ShoppingBag size={36} color={colors.primary} />
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <TrendingDown size={12} color={colors.white} />
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          {isMystery && (
            <View style={styles.mysteryPill}>
              <Text style={styles.mysteryPillText}>Mystery bag</Text>
            </View>
          )}
          {bag.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{bag.category}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bagBody}>
          <View style={styles.bagTitleRow}>
            <Text style={styles.bagName} numberOfLines={1}>
              {bag.name}
            </Text>
            <View
              style={[
                styles.stockPill,
                leftCount <= 2 && styles.stockPillUrgent,
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  leftCount <= 2 && styles.stockPillTextUrgent,
                ]}
              >
                {leftCount} left
              </Text>
            </View>
          </View>

          <Text style={styles.shopName} numberOfLines={1}>
            {bag.sellerName}
          </Text>

          <View style={styles.bagMeta}>
            <Star size={13} color="#FFC107" fill="#FFC107" />
            <Text style={styles.ratingText}>{bag.rating.toFixed(1)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <MapPin size={13} color={colors.textSoft} />
            <Text style={styles.distanceText}>
              {computedDistance.toFixed(1)} km
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Clock size={13} color={colors.textSoft} />
            <Text style={styles.timeText}>{formatTime(bag.expiryDate)}</Text>
          </View>

          <View style={styles.bagFooter}>
            <View>
              <Text style={styles.price}>
                RM {prices.salePrice.toFixed(2)}
              </Text>
              {prices.compareAtPrice != null && (
                <Text style={styles.originalPrice}>
                  RM {prices.compareAtPrice.toFixed(2)}
                </Text>
              )}
            </View>
            <View style={styles.reserveHint}>
              <Text style={styles.reserveHintText}>View deal</Text>
              <ChevronRight size={16} color={colors.primary} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const buyerStats = await getBuyerStats(user.uid);
        setStats(buyerStats);
        await loadBagsByLocation(userLocation);
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding deals near you…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <View style={styles.headerIntro}>
            <View style={styles.greetingRow}>
              <Sparkles size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greeting}>
                {getGreeting()}
                {buyerName ? `, ${buyerName}` : ""}
              </Text>
            </View>
            <Text style={styles.headerTitle}>Rescue food nearby</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() =>
                pushWithReturn(router, "/(buyer)/buyercart", BUYER_ROUTES.home)
              }
            >
              <ShoppingCart size={22} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push("/(buyer)/buyerprofile")}
            >
              <User size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.locationBlock}>
          <Text style={styles.locationLabel}>Delivering near</Text>
          {!headerSearchActive ? (
            <TouchableOpacity
              style={styles.locationPill}
              onPress={() => setHeaderSearchActive(true)}
              activeOpacity={0.85}
            >
              <MapPin size={18} color={colors.primary} />
              <Text style={styles.locationPillText} numberOfLines={1}>
                {location}
              </Text>
              <ChevronRight size={16} color={colors.textSoft} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerLocationInputRow}>
              <MapPin size={18} color={colors.primary} />
              <TextInput
                style={styles.headerLocationInput}
                placeholder="Search area or city..."
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
                placeholderTextColor={colors.textSoft}
                autoFocus
              />
              {locationSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setLocationSearchQuery("");
                    setLocationSuggestions([]);
                  }}
                >
                  <X size={18} color={colors.textSoft} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Location Suggestions Dropdown */}
      {headerSearchActive && (
        <View style={styles.headerSuggestionsContainer}>
          {locationSearchQuery.trim().length < 3 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickCitiesScroll}
              contentContainerStyle={styles.quickCitiesContent}
            >
              {QUICK_CITY_LOCATIONS.map((city) => (
                <TouchableOpacity
                  key={city.label}
                  style={styles.quickCityChip}
                  onPress={() => {
                    applySelectedLocation(city);
                    setHeaderSearchActive(false);
                  }}
                  disabled={settingLocation}
                >
                  <Text style={styles.quickCityText}>{city.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

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

      <View style={styles.searchBarSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color={colors.textSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, shop, category..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSoft}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={18} color={colors.textSoft} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterToggleBtn,
              filtersOpen && styles.filterToggleBtnActive,
            ]}
            onPress={() => setFiltersOpen((open) => !open)}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={18} color={colors.white} />
            <Text style={styles.filterToggleLabel}>Filter</Text>
            {advancedFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{advancedFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {filtersOpen ? (
          <View style={styles.filtersPanel}>
            <View style={styles.filtersPanelHeader}>
              <Text style={styles.filtersPanelTitle}>Filters</Text>
              {advancedFilterCount > 0 ? (
                <TouchableOpacity onPress={clearAdvancedFilters}>
                  <Text style={styles.filtersClearText}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.filterGroupLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.key}
                  label={opt.label}
                  active={selectedCategory === opt.key}
                  onPress={() => setSelectedCategory(opt.key)}
                />
              ))}
            </ScrollView>

            <Text style={styles.filterGroupLabel}>Price</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {PRICE_RANGES.map((opt) => (
                <FilterChip
                  key={opt.key}
                  label={opt.label}
                  active={priceRange === opt.key}
                  onPress={() => setPriceRange(opt.key)}
                />
              ))}
            </ScrollView>

            <Text style={styles.filterGroupLabel}>Sort by</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {SORT_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.key}
                  label={opt.label}
                  active={sortBy === opt.key}
                  onPress={() => setSortBy(opt.key)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.mainScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.body}>
          <LinearGradient
            colors={["#6a3c00", "#8B5A2B", "#A67C52"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroDecor} />
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <Zap size={14} color={colors.white} />
                <Text style={styles.heroBadgeText}>Surplus deals</Text>
              </View>
              <TouchableOpacity
                style={styles.heroMapBtn}
                onPress={() => router.push("/(buyer)/buyermap")}
              >
                <MapPin size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroTitle}>
              {displayBags.length > 0
                ? `${displayBags.length} deals near you`
                : "Discover food nearby"}
            </Text>
            <Text style={styles.heroSub}>
              {lowestPrice != null
                ? `From RM ${lowestPrice.toFixed(2)} · Save food before it goes to waste`
                : "Set your location to see surplus from local cafés"}
            </Text>
            {bestDeal && getDiscountPct(bestDeal) > 0 ? (
              <TouchableOpacity
                style={styles.heroDealRow}
                onPress={() => navigateToBag(bestDeal)}
                activeOpacity={0.9}
              >
                <View style={styles.heroDealLeft}>
                  <Text style={styles.heroDealLabel}>Top pick</Text>
                  <Text style={styles.heroDealName} numberOfLines={1}>
                    {bestDeal.name}
                  </Text>
                </View>
                <View style={styles.heroDealBadge}>
                  <Text style={styles.heroDealBadgeText}>
                    -{getDiscountPct(bestDeal)}%
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>
                  {formatMeals(stats?.mealsRescued ?? 0)}
                </Text>
                <Text style={styles.heroStatLbl}>meals</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>
                  RM {(stats?.moneySaved ?? 0).toFixed(0)}
                </Text>
                <Text style={styles.heroStatLbl}>saved</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>
                  {formatCo2(stats?.co2Saved ?? 0)}
                </Text>
                <Text style={styles.heroStatLbl}>CO₂ cut</Text>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                active={activeFilter === f.key}
                onPress={() => setActiveFilter(f.key)}
              />
            ))}
          </ScrollView>

          {endingSoonBags.length > 0 && activeFilter === "all" ? (
            <View style={styles.carouselSection}>
              <View style={styles.carouselHeader}>
                <View style={styles.carouselTitleRow}>
                  <Flame size={18} color={colors.error} />
                  <Text style={styles.carouselTitle}>Ending soon</Text>
                </View>
                <Text style={styles.carouselSub}>Grab them before they&apos;re gone</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
              >
                {endingSoonBags.map((bag, i) => renderBagCard(bag, i, true))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {activeFilter === "deals"
                    ? "Best deals"
                    : activeFilter === "mystery"
                      ? "Mystery bags"
                      : activeFilter === "items"
                        ? "Single items"
                        : "All listings"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {displayBags.length} available
                  {activeFilter === "deals" || sortBy === "discount"
                    ? " · best discount first"
                    : sortBy === "price_asc"
                      ? " · lowest price first"
                      : sortBy === "price_desc"
                        ? " · highest price first"
                        : " · nearest first"}
                </Text>
              </View>
            </View>

          {displayBags.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Package size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No listings in your area</Text>
              <Text style={styles.emptySubtext}>
                We only show surplus from sellers in your state. Try another
                city or check back soon.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setHeaderSearchActive(true)}
              >
                <MapPin size={16} color={colors.white} />
                <Text style={styles.emptyBtnText}>Change location</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayBags.map((bag, index) => renderBagCard(bag, index))
          )}
          </View>

          <View style={styles.impactBanner}>
            <View style={styles.impactBannerIcon}>
              <Leaf size={24} color={colors.success} />
            </View>
            <View style={styles.impactBannerContent}>
              <Text style={styles.impactBannerTitle}>
                You&apos;re making a difference
              </Text>
              <Text style={styles.impactBannerText}>
                {formatMeals(stats?.mealsRescued ?? 0)} meals rescued and{" "}
                {formatCo2(stats?.co2Saved ?? 0)} CO₂ kept out of the atmosphere.
                Keep it up!
              </Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textSoft },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -40,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  headerIntro: { flex: 1, marginRight: spacing.md },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.3,
  },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationBlock: { gap: 6 },
  locationLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  locationPillText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  headerLocationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  headerLocationInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },
  headerSuggestionsContainer: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    maxHeight: 340,
    marginTop: -8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  quickCitiesScroll: { maxHeight: 44 },
  quickCitiesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  quickCityChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickCityText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
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
  mainScroll: {
    flex: 1,
  },
  searchBarSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 5,
    elevation: 4,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  filterToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 88,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  filterToggleBtnActive: {
    backgroundColor: "#4a2800",
    borderColor: "#4a2800",
  },
  filterToggleLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.white,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.white,
  },
  filtersPanel: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  filtersPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  filtersPanelTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  filtersClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  filterChipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroCard: {
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  heroDecor: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -30,
    right: -20,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  heroMapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  heroDealRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  heroDealLeft: { flex: 1 },
  heroDealLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroDealName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  heroDealBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  heroDealBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.white,
  },
  heroStats: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 12,
    paddingVertical: spacing.sm,
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatVal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  heroStatLbl: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterScroll: { marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  filterRow: { paddingHorizontal: spacing.lg },
  carouselSection: { marginBottom: spacing.lg },
  carouselHeader: { marginBottom: spacing.sm },
  carouselTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  carouselTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  carouselSub: { fontSize: 12, color: colors.textSoft },
  carouselContent: { gap: spacing.md, paddingRight: spacing.lg },
  compactCard: {
    width: 156,
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  compactImageWrap: {
    height: 100,
    backgroundColor: colors.primarySoft,
    position: "relative",
  },
  compactImage: { width: "100%", height: "100%" },
  compactPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compactDiscount: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  compactDiscountText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.white,
  },
  compactName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 10,
    paddingTop: 8,
    lineHeight: 17,
  },
  compactShop: {
    fontSize: 11,
    color: colors.textSoft,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  compactFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    paddingTop: 8,
  },
  compactPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  compactUrgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  compactUrgentText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
  },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginBottom: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bagImageWrap: {
    width: "100%",
    height: 160,
    position: "relative",
    backgroundColor: colors.primarySoft,
  },
  bagImage: { width: "100%", height: "100%" },
  bagImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  discountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discountText: { fontSize: 12, fontWeight: "700", color: colors.white },
  mysteryPill: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mysteryPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
  },
  categoryPill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  bagBody: { padding: spacing.md },
  bagTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  bagName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  stockPill: {
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockPillUrgent: {
    backgroundColor: colors.errorSoft,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  stockPillTextUrgent: { color: colors.error },
  shopName: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: 8,
    fontWeight: "500",
  },
  bagMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: spacing.md,
  },
  ratingText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  metaDot: { fontSize: 12, color: colors.textSoft },
  distanceText: { fontSize: 12, color: colors.textSoft },
  timeText: { fontSize: 12, color: colors.textSoft },
  bagFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  price: { fontSize: 22, fontWeight: "800", color: colors.primary },
  originalPrice: {
    fontSize: 12,
    color: colors.textSoft,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  reserveHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reserveHintText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  impactBanner: {
    flexDirection: "row",
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(143,151,121,0.25)",
  },
  impactBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  impactBannerContent: { flex: 1 },
  impactBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  impactBannerText: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
});
