import { Text } from "@/src/components/StyledText";
import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import {
  resolveSellerLocationHeroImage,
} from "@/src/services/places/googlePlaces";
import { colors, spacing } from "@/src/theme/styles";
import { getPreferredLocation } from "@/src/utils/locationPreference";
import { resolveBuyerPriceDisplay } from "@/src/utils/listingPrices";
import * as Location from "expo-location";
import { BUYER_ROUTES, pushWithReturn } from "@/src/utils/navigation";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRight,
  Clock,
  MapPin,
  ShoppingBag,
  Star,
  Store,
  TrendingDown,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

type ShopOnMap = {
  sellerId: string;
  sellerName: string;
  latitude: number;
  longitude: number;
  distance: number;
  items: AvailableBag[];
  listingCount: number;
  minPrice: number;
  maxDiscount: number;
  imageUrl?: string;
  googlePlaceId?: string;
  businessAddress?: string;
  sellerRegistrationPhotoUrl?: string;
  categories: string[];
};

const getBagPrice = (bag: AvailableBag) =>
  resolveBuyerPriceDisplay(bag).salePrice;

const getDiscountPct = (bag: AvailableBag) =>
  resolveBuyerPriceDisplay(bag).discountPct;

function groupBagsIntoShops(bags: AvailableBag[]): ShopOnMap[] {
  const bySeller = new Map<string, AvailableBag[]>();

  bags.forEach((bag) => {
    const lat = Number(bag.latitude);
    const lng = Number(bag.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const list = bySeller.get(bag.sellerId) ?? [];
    list.push(bag);
    bySeller.set(bag.sellerId, list);
  });

  return [...bySeller.entries()].map(([sellerId, items]) => {
    const sorted = [...items].sort((a, b) => a.distance - b.distance);
    const first = sorted[0];
    const withImage = sorted.find((i) => i.imageUrl);
    const discounts = sorted.map(getDiscountPct);
    const categories = [
      ...new Set(sorted.map((i) => i.category).filter(Boolean)),
    ] as string[];

    return {
      sellerId,
      sellerName: first.sellerName,
      latitude: Number(first.latitude),
      longitude: Number(first.longitude),
      distance: first.distance,
      items: sorted,
      listingCount: sorted.length,
      minPrice: Math.min(...sorted.map((i) => getBagPrice(i))),
      maxDiscount: Math.max(...discounts, 0),
      imageUrl: withImage?.imageUrl,
      googlePlaceId: first.googlePlaceId,
      businessAddress: first.businessAddress,
      sellerRegistrationPhotoUrl: first.sellerRegistrationPhotoUrl,
      categories,
    };
  });
}

function navigateToBag(bag: AvailableBag) {
  if (bag.type === "bag") {
    pushWithReturn(
      router,
      "/(buyer)/mysterydetail/[id]",
      BUYER_ROUTES.map,
      { id: bag.id ?? "" },
    );
  } else {
    pushWithReturn(
      router,
      "/(buyer)/itemdetail/[id]",
      BUYER_ROUTES.map,
      { id: bag.id ?? "" },
    );
  }
}

export default function BuyerMap() {
  const mapRef = useRef<MapView>(null);
  const [bags, setBags] = useState<AvailableBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<ShopOnMap | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroImageLoading, setHeroImageLoading] = useState(false);
  const [region, setRegion] = useState({
    latitude: 3.139,
    longitude: 101.6869,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const shops = useMemo(() => groupBagsIntoShops(bags), [bags]);

  const fitMapToShops = useCallback(
    (
      userCoords: { latitude: number; longitude: number },
      groupedShops: ShopOnMap[],
    ) => {
      if (!mapRef.current || groupedShops.length === 0) return;

      const coordinates = [
        userCoords,
        ...groupedShops.map((shop) => ({
          latitude: shop.latitude,
          longitude: shop.longitude,
        })),
      ];

      requestAnimationFrame(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 120, right: 48, bottom: 180, left: 48 },
          animated: true,
        });
      });
    },
    [],
  );

  const loadMapData = useCallback(async () => {
    try {
      setLoading(true);
      const preferredLocation = await getPreferredLocation();

      const loc = preferredLocation
        ? {
            latitude: preferredLocation.latitude,
            longitude: preferredLocation.longitude,
          }
        : await getLocation();

      setRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      });

      const nearbyBags = await getAvailableBags({
        ...loc,
        locationLabel: preferredLocation?.label,
      });
      setBags(nearbyBags);

      const grouped = groupBagsIntoShops(nearbyBags);
      if (grouped.length > 0) {
        fitMapToShops(loc, grouped);
      }
    } catch (err) {
      console.error("Error loading map data:", err);
    } finally {
      setLoading(false);
    }
  }, [fitMapToShops]);

  useFocusEffect(
    useCallback(() => {
      loadMapData();
    }, [loadMapData]),
  );

  useEffect(() => {
    if (!selectedShop) {
      setHeroImageUrl(null);
      setHeroImageLoading(false);
      return;
    }

    let cancelled = false;
    setHeroImageLoading(true);
    setHeroImageUrl(selectedShop.sellerRegistrationPhotoUrl ?? null);

    resolveSellerLocationHeroImage(
      selectedShop.latitude,
      selectedShop.longitude,
      selectedShop.googlePlaceId,
    )
      .then((url) => {
        if (!cancelled) {
          setHeroImageUrl(
            url ??
              selectedShop.sellerRegistrationPhotoUrl ??
              selectedShop.imageUrl ??
              null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHeroImageUrl(
            selectedShop.sellerRegistrationPhotoUrl ??
              selectedShop.imageUrl ??
              null,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHeroImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedShop]);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { latitude: 3.139, longitude: 101.6869 };
    const loc = await Location.getCurrentPositionAsync({});
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

  const selectShop = (shop: ShopOnMap) => {
    setSelectedShop(shop);
    setRegion((prev) => ({
      ...prev,
      latitude: shop.latitude,
      longitude: shop.longitude,
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading nearby shops…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Store size={40} color={colors.primary} />
          <Text style={styles.fallbackTitle}>Map is not available on web</Text>
          <Text style={styles.fallbackText}>
            Open on Android or iOS to browse shops on the map.
          </Text>
          <Text style={styles.fallbackText}>{shops.length} shops found</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (shops.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <MapPin size={40} color={colors.primary} />
          <Text style={styles.fallbackTitle}>No shops in your area</Text>
          <Text style={styles.fallbackText}>
            Listings are limited to sellers in your state. Change your location
            on home to browse another area.
          </Text>
          <TouchableOpacity
            style={styles.fallbackBtn}
            onPress={() => router.push("/(buyer)/buyerhome")}
          >
            <Text style={styles.fallbackBtnText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        onPress={() => setSelectedShop(null)}
      >
        {shops.map((shop) => {
          const isSelected = selectedShop?.sellerId === shop.sellerId;
          return (
            <Marker
              key={shop.sellerId}
              coordinate={{
                latitude: shop.latitude,
                longitude: shop.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                selectShop(shop);
              }}
            >
              <View
                style={[
                  styles.markerWrap,
                  isSelected && styles.markerWrapSelected,
                ]}
              >
                <Store
                  size={18}
                  color={isSelected ? colors.white : colors.primary}
                />
                <View
                  style={[
                    styles.markerBadge,
                    isSelected && styles.markerBadgeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.markerBadgeText,
                      isSelected && styles.markerBadgeTextSelected,
                    ]}
                  >
                    {shop.listingCount}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Nearby shops</Text>
        <Text style={styles.topBarSub}>
          {shops.length} {shops.length === 1 ? "shop" : "shops"} · tap a pin
        </Text>
      </View>

      {selectedShop ? (
        <View style={styles.previewCard}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setSelectedShop(null)}
          >
            <X size={20} color={colors.textSoft} />
          </TouchableOpacity>

          <View style={styles.previewHero}>
            {heroImageLoading && !heroImageUrl ? (
              <View style={styles.previewImagePlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : heroImageUrl ? (
              <Image
                source={{ uri: heroImageUrl }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewImagePlaceholder}>
                <MapPin size={40} color={colors.primary} />
                <Text style={styles.previewImageFallback}>
                  Location photo unavailable
                </Text>
              </View>
            )}
            <View style={styles.previewHeroOverlay} />
            {selectedShop.maxDiscount > 0 && (
              <View style={styles.previewDiscount}>
                <TrendingDown size={12} color={colors.white} />
                <Text style={styles.previewDiscountText}>
                  Up to {selectedShop.maxDiscount}% off
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.previewScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <View style={styles.previewBody}>
            <Text style={styles.previewName}>{selectedShop.sellerName}</Text>

            {selectedShop.businessAddress ? (
              <Text style={styles.previewAddress} numberOfLines={2}>
                {selectedShop.businessAddress}
              </Text>
            ) : null}

            <View style={styles.previewMeta}>
              <Star size={14} color="#FFC107" fill="#FFC107" />
              <Text style={styles.previewMetaText}>
                {selectedShop.items[0]?.rating.toFixed(1) ?? "4.8"}
              </Text>
              <Text style={styles.previewMetaDot}>·</Text>
              <MapPin size={14} color={colors.textSoft} />
              <Text style={styles.previewMetaText}>
                {selectedShop.distance.toFixed(1)} km away
              </Text>
              <Text style={styles.previewMetaDot}>·</Text>
              <ShoppingBag size={14} color={colors.textSoft} />
              <Text style={styles.previewMetaText}>
                {selectedShop.listingCount} listings
              </Text>
            </View>

            {selectedShop.categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {selectedShop.categories.map((cat) => (
                  <View key={cat} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{cat}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <Text style={styles.previewPriceLine}>
              From{" "}
              <Text style={styles.previewPriceBold}>
                RM {selectedShop.minPrice.toFixed(2)}
              </Text>
            </Text>

            <Text style={styles.previewSectionLabel}>Available now</Text>
            {selectedShop.items.slice(0, 3).map((item) => {
              const left = item.quantity - (item.sold || 0);
              const discount = getDiscountPct(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.previewItemRow}
                  onPress={() => navigateToBag(item)}
                  activeOpacity={0.85}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.previewItemThumb}
                    />
                  ) : (
                    <View style={styles.previewItemThumbPlaceholder}>
                      <ShoppingBag size={16} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.previewItemInfo}>
                    <Text style={styles.previewItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.previewItemMeta}>
                      <Clock size={12} color={colors.textSoft} />
                      <Text style={styles.previewItemMetaText}>
                        {item.expiryDate || "Today"} · {left} left
                      </Text>
                    </View>
                  </View>
                  <View style={styles.previewItemRight}>
                    <Text style={styles.previewItemPrice}>
                      RM {getBagPrice(item).toFixed(2)}
                    </Text>
                    {discount > 0 && (
                      <Text style={styles.previewItemDiscount}>
                        -{discount}%
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {selectedShop.items.length > 3 && (
              <Text style={styles.moreItems}>
                +{selectedShop.items.length - 3} more at this shop
              </Text>
            )}

            <TouchableOpacity
              style={styles.previewCta}
              onPress={() => navigateToBag(selectedShop.items[0])}
              activeOpacity={0.9}
            >
              <Text style={styles.previewCtaText}>View shop deals</Text>
              <ChevronRight size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.shopStrip}
          contentContainerStyle={styles.shopStripContent}
        >
          {shops.map((shop) => (
            <TouchableOpacity
              key={shop.sellerId}
              style={styles.shopChip}
              onPress={() => selectShop(shop)}
              activeOpacity={0.9}
            >
              {shop.sellerRegistrationPhotoUrl ? (
                <Image
                  source={{ uri: shop.sellerRegistrationPhotoUrl }}
                  style={styles.shopChipImage}
                />
              ) : shop.imageUrl ? (
                <Image source={{ uri: shop.imageUrl }} style={styles.shopChipImage} />
              ) : (
                <View style={styles.shopChipPlaceholder}>
                  <Store size={20} color={colors.primary} />
                </View>
              )}
              <View style={styles.shopChipInfo}>
                <Text style={styles.shopChipName} numberOfLines={1}>
                  {shop.sellerName}
                </Text>
                <Text style={styles.shopChipSub}>
                  {shop.listingCount} items · {shop.distance.toFixed(1)} km
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textSoft },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  fallbackText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 21,
  },
  fallbackBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  fallbackBtnText: { color: colors.white, fontWeight: "700" },
  topBar: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  topBarSub: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },
  markerWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  markerWrapSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 1.1 }],
  },
  markerBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  markerBadgeSelected: {
    backgroundColor: colors.white,
  },
  markerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.white,
  },
  markerBadgeTextSelected: {
    color: colors.primary,
  },
  shopStrip: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    maxHeight: 100,
  },
  shopStripContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  shopChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.sm,
    width: 220,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  shopChipImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  shopChipPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  shopChipInfo: { flex: 1 },
  shopChipName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  shopChipSub: { fontSize: 11, color: colors.textSoft },
  previewCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: "52%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  previewClose: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewHero: {
    height: 140,
    backgroundColor: colors.primarySoft,
    position: "relative",
  },
  previewImage: { width: "100%", height: "100%" },
  previewImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  previewImageFallback: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
  },
  previewHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  previewDiscount: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  previewDiscountText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  previewScroll: { maxHeight: 280 },
  previewBody: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  previewName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    paddingRight: 36,
  },
  previewAddress: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
    marginBottom: spacing.sm,
    paddingRight: 36,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: spacing.sm,
  },
  previewMetaText: { fontSize: 12, color: colors.textSoft },
  previewMetaDot: { color: colors.textSoft, fontSize: 12 },
  categoryScroll: { marginBottom: spacing.sm },
  categoryChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  previewPriceLine: {
    fontSize: 14,
    color: colors.textSoft,
    marginBottom: spacing.md,
  },
  previewPriceBold: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  previewItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  previewItemThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  previewItemInfo: { flex: 1 },
  previewItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  previewItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewItemMetaText: { fontSize: 11, color: colors.textSoft },
  previewItemRight: { alignItems: "flex-end" },
  previewItemPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  previewItemDiscount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.error,
    marginTop: 2,
  },
  moreItems: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    marginVertical: spacing.sm,
  },
  previewCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  previewCtaText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
});
