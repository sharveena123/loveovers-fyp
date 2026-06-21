import * as Location from "expo-location";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { computeLiveListingPrice } from "@/src/services/pricing/dynamicPricing";
import { getListingFloor } from "@/src/utils/listingPrices";
import {
  extractStateFromAddress,
  malaysianStatesMatch,
  normalizeMalaysianState,
  type MalaysianState,
  resolveStateFromGeocode,
} from "@/src/utils/malaysianState";
import { InventoryItem, inventoryService } from "./inventoryServices";

export interface AvailableBag extends InventoryItem {
  sellerId: string;
  sellerName: string;
  distance: number;
  rating: number;
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  businessAddress?: string;
  sellerRegistrationPhotoUrl?: string;
  /** Seller list floor before live smart-pricing markdown (Firestore values). */
  listFloorPrice: number;
  /** Extra markdown % applied on top of list floor when smart pricing is on. */
  smartLiveMarkdownPct?: number;
  smartAbVariant?: "A" | "B";
}

type Coordinates = {
  latitude: number;
  longitude: number;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

/** Storefront (business) or workspace/pickup photo (manual) from seller registration. */
export function pickSellerRegistrationPhoto(
  sellerData: Record<string, unknown>,
): string | undefined {
  const business = sellerData.businessVerification as
    | { storefrontImageUrl?: string }
    | undefined;
  const storefront = business?.storefrontImageUrl?.trim();
  if (storefront) return storefront;

  const manual = sellerData.manualVerification as
    | {
        workspacePhotoUrls?: string[];
        sampleProductPhotoUrls?: string[];
      }
    | undefined;

  const workspace = manual?.workspacePhotoUrls?.find(
    (url) => typeof url === "string" && url.trim().length > 0,
  );
  if (workspace?.trim()) return workspace.trim();

  const sample = manual?.sampleProductPhotoUrls?.find(
    (url) => typeof url === "string" && url.trim().length > 0,
  );
  if (sample?.trim()) return sample.trim();

  const profileImage =
    typeof sellerData.profileImageUrl === "string"
      ? sellerData.profileImageUrl.trim()
      : "";
  return profileImage || undefined;
}

const extractCoordinates = (
  sellerData: Record<string, any>,
): Coordinates | null => {
  const latitude =
    toNumber(sellerData.latitude) ??
    toNumber(sellerData.lat) ??
    toNumber(sellerData.location?.latitude) ??
    toNumber(sellerData.location?.lat) ??
    toNumber(sellerData.coordinates?.latitude) ??
    toNumber(sellerData.coordinates?.lat);

  const longitude =
    toNumber(sellerData.longitude) ??
    toNumber(sellerData.lng) ??
    toNumber(sellerData.lon) ??
    toNumber(sellerData.location?.longitude) ??
    toNumber(sellerData.location?.lng) ??
    toNumber(sellerData.location?.lon) ??
    toNumber(sellerData.coordinates?.longitude) ??
    toNumber(sellerData.coordinates?.lng) ??
    toNumber(sellerData.coordinates?.lon);

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
};

const geocodeSellerAddress = async (
  sellerId: string,
  sellerData: Record<string, any>,
): Promise<Coordinates | null> => {
  const address =
    typeof sellerData.businessAddress === "string"
      ? sellerData.businessAddress.trim()
      : "";

  if (!address) return null;

  try {
    const results = await Location.geocodeAsync(address);
    const first = results[0];
    if (!first) return null;

    const resolved: Coordinates = {
      latitude: first.latitude,
      longitude: first.longitude,
    };

    try {
      await updateDoc(doc(db, "sellers", sellerId), {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
    } catch (persistError) {
      console.warn(
        "Could not persist seller coordinates, using in-memory fallback:",
        sellerId,
        persistError,
      );
    }

    return resolved;
  } catch (error) {
    console.error("Error geocoding seller address:", sellerId, error);
    return null;
  }
};

// 📏 Haversine distance (km)
const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const resolveStateFromCoordinates = async (
  coords: Coordinates,
  cache: Map<string, MalaysianState | null>,
): Promise<MalaysianState | null> => {
  const cacheKey = `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  try {
    const results = await Location.reverseGeocodeAsync(coords);
    const state = results[0] ? resolveStateFromGeocode(results[0]) : null;
    cache.set(cacheKey, state);
    return state;
  } catch (error) {
    console.warn("Could not reverse-geocode coordinates for state filter:", error);
    cache.set(cacheKey, null);
    return null;
  }
};

const resolveSellerState = async (
  sellerData: Record<string, any>,
  sellerCoords: Coordinates,
  cache: Map<string, MalaysianState | null>,
): Promise<MalaysianState | null> => {
  const address =
    typeof sellerData.businessAddress === "string"
      ? sellerData.businessAddress.trim()
      : "";
  const fromAddress = address ? extractStateFromAddress(address) : null;
  if (fromAddress) return fromAddress;

  return resolveStateFromCoordinates(sellerCoords, cache);
};

const resolveBuyerState = async (
  userLocation: {
    latitude: number;
    longitude: number;
    locationLabel?: string;
  },
  cache: Map<string, MalaysianState | null>,
): Promise<MalaysianState | null> => {
  const fromCoords = await resolveStateFromCoordinates(
    {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    },
    cache,
  );
  if (fromCoords) return fromCoords;

  const label = userLocation.locationLabel?.trim();
  if (!label) return null;

  return extractStateFromAddress(label) ?? normalizeMalaysianState(label);
};

// 🎯 MAIN FUNCTION
export const getAvailableBags = async (userLocation: {
  latitude: number;
  longitude: number;
  locationLabel?: string;
}): Promise<AvailableBag[]> => {
  try {
    const stateCache = new Map<string, MalaysianState | null>();
    const buyerState = await resolveBuyerState(userLocation, stateCache);

    if (!buyerState) {
      console.warn(
        "Buyer state could not be resolved — showing no cross-state listings.",
      );
      return [];
    }

    const nearbyBags: AvailableBag[] = [];

    // Get all sellers
    const sellersSnapshot = await getDocs(collection(db, "sellers"));
    const now = new Date();

    for (const sellerDoc of sellersSnapshot.docs) {
      const sellerData = sellerDoc.data() as Record<string, any>;

      const verificationStatus = sellerData.verificationStatus as
        | string
        | undefined;
      if (
        verificationStatus &&
        verificationStatus !== "approved"
      ) {
        continue;
      }
      if (sellerData.isActive === false) {
        continue;
      }

      const closingHourRaw = toNumber(sellerData.smartPricingClosingHour);
      const closingHour =
        closingHourRaw !== null && closingHourRaw >= 12 && closingHourRaw <= 23
          ? closingHourRaw
          : 20;

      // Purge expired inventory and refresh statuses for active listings
      try {
        await inventoryService.updateItemStatuses(sellerDoc.id);
      } catch (statusError) {
        console.warn(`Failed to update item statuses for seller ${sellerDoc.id}:`, statusError);
      }

      let sellerCoords = extractCoordinates(sellerData);

      if (!sellerCoords) {
        sellerCoords = await geocodeSellerAddress(sellerDoc.id, sellerData);
      }

      // Skip sellers that still have no usable location
      if (!sellerCoords) continue;

      const sellerState = await resolveSellerState(
        sellerData,
        sellerCoords,
        stateCache,
      );
      if (!malaysianStatesMatch(buyerState, sellerState)) {
        continue;
      }

      // 📏 Calculate distance from user
      const distance = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        sellerCoords.latitude,
        sellerCoords.longitude,
      );

      // Get active inventory
      const inventoryRef = collection(db, "sellers", sellerDoc.id, "inventory");
      const activeQuery = query(
        inventoryRef,
        where("status", "in", ["active", "fresh", "expiring"]),
      );

      const inventorySnapshot = await getDocs(activeQuery);

      const registrationPhotoUrl = pickSellerRegistrationPhoto(sellerData);

      inventorySnapshot.forEach((doc) => {
        const item = doc.data() as InventoryItem;

        // Only include items with stock
        if (item.quantity - (item.sold || 0) > 0) {
          const listFloor = getListingFloor(item);
          const live = computeLiveListingPrice(item, {
            now,
            closingHour,
            listingId: doc.id,
            sellerId: sellerDoc.id,
          });

          const bag: AvailableBag = {
            ...item,
            id: doc.id,
            sellerId: sellerDoc.id,
            sellerName: sellerData.businessName || "Unknown Seller",
            distance,
            rating: 4.8, // you can replace later
            latitude: sellerCoords.latitude,
            longitude: sellerCoords.longitude,
            googlePlaceId:
              typeof sellerData.googlePlaceId === "string"
                ? sellerData.googlePlaceId
                : undefined,
            businessAddress:
              typeof sellerData.businessAddress === "string"
                ? sellerData.businessAddress
                : undefined,
            sellerRegistrationPhotoUrl: registrationPhotoUrl,
            listFloorPrice: listFloor,
            price: live.price,
            discountedPrice: live.discountedPrice,
            originalPrice: live.originalPrice,
            smartLiveMarkdownPct: live.smartLiveMarkdownPct,
            smartAbVariant: live.smartAbVariant,
          };

          nearbyBags.push(bag);
        }
      });
    }

    return nearbyBags.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error("Error fetching available bags:", error);
    return [];
  }
};
