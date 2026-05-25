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
import { InventoryItem, inventoryService } from "./inventoryServices";

export interface AvailableBag extends InventoryItem {
  sellerId: string;
  sellerName: string;
  distance: number;
  rating: number;
  latitude: number;
  longitude: number;
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

// 🎯 MAIN FUNCTION
export const getAvailableBags = async (userLocation: {
  latitude: number;
  longitude: number;
}): Promise<AvailableBag[]> => {
  try {
    const nearbyBags: AvailableBag[] = [];
    const allLocatedBags: AvailableBag[] = [];
    const RADIUS_KM = 5;

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

      inventorySnapshot.forEach((doc) => {
        const item = doc.data() as InventoryItem;

        // Only include items with stock
        if (item.quantity - (item.sold || 0) > 0) {
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
            price: live.price,
            discountedPrice: live.discountedPrice,
            originalPrice: live.originalPrice,
            smartLiveMarkdownPct: live.smartLiveMarkdownPct,
            smartAbVariant: live.smartAbVariant,
          };

          allLocatedBags.push(bag);
          if (distance <= RADIUS_KM) {
            nearbyBags.push(bag);
          }
        }
      });
    }

    // Prefer nearby sellers, but fall back to all located sellers so the map is never empty when stock exists.
    const result = nearbyBags.length > 0 ? nearbyBags : allLocatedBags;
    return result.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error("Error fetching available bags:", error);
    return [];
  }
};
