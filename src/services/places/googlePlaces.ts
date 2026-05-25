import Constants from "expo-constants";

export type FoodPlaceSuggestion = {
  label: string;
  placeId: string;
  primaryType?: string;
};

export type FoodPlaceDetails = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  googleMapsUri: string;
  primaryType?: string;
};

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  (Constants.expoConfig?.extra?.googlePlacesApiKey as string | undefined) ||
  "";

/** Cafés, bakeries, restaurants, and similar food businesses in Malaysia. */
const FOOD_PRIMARY_TYPES = [
  "restaurant",
  "cafe",
  "bakery",
  "meal_takeaway",
  "coffee_shop",
];

const DEFAULT_BIAS = {
  latitude: 3.139,
  longitude: 101.6869,
  radius: 50000,
};

export function hasGooglePlacesApiKey(): boolean {
  return GOOGLE_PLACES_API_KEY.length > 0;
}

export async function searchFoodPlaces(
  query: string,
): Promise<FoodPlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || !GOOGLE_PLACES_API_KEY) return [];

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.types",
      },
      body: JSON.stringify({
        input: trimmed,
        languageCode: "en",
        includedRegionCodes: ["MY"],
        includedPrimaryTypes: FOOD_PRIMARY_TYPES,
        locationBias: {
          circle: {
            center: {
              latitude: DEFAULT_BIAS.latitude,
              longitude: DEFAULT_BIAS.longitude,
            },
            radius: DEFAULT_BIAS.radius,
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
            types?: string[];
          };
        }[];
        error?: { message?: string };
      })
    : {};

  if (!response.ok || data.error?.message) {
    throw new Error(
      data.error?.message ||
        `Places search failed (${response.status})`,
    );
  }

  return (data.suggestions || [])
    .map((item) => {
      const prediction = item.placePrediction;
      const textValue = prediction?.text;
      const label =
        typeof textValue === "string" ? textValue : textValue?.text || "";
      return {
        label,
        placeId: prediction?.placeId || "",
        primaryType: prediction?.types?.[0],
      };
    })
    .filter((item) => item.label.length > 0 && item.placeId.length > 0);
}

export async function fetchFoodPlaceDetails(
  placeId: string,
): Promise<FoodPlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY || !placeId) return null;

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,googleMapsUri,primaryType,types",
      },
    },
  );

  const payloadText = await response.text();
  const data = payloadText
    ? (JSON.parse(payloadText) as {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        googleMapsUri?: string;
        primaryType?: string;
        types?: string[];
        error?: { message?: string };
      })
    : {};

  if (!response.ok || data.error?.message) {
    throw new Error(
      data.error?.message || `Place details failed (${response.status})`,
    );
  }

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const displayName = data.displayName?.text?.trim() || "";
  const formattedAddress = data.formattedAddress?.trim() || displayName;
  const googleMapsUri =
    data.googleMapsUri?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}&query_place_id=${placeId}`;

  return {
    placeId,
    displayName,
    formattedAddress,
    latitude: Number(lat),
    longitude: Number(lng),
    googleMapsUri,
    primaryType: data.primaryType || data.types?.[0],
  };
}

export function formatPlaceTypeLabel(type?: string): string {
  if (!type) return "Food business";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
