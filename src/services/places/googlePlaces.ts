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
  return searchPlaces(query, { foodBusinessesOnly: true });
}

/** General place search — addresses, landmarks, neighbourhoods (not limited to food businesses). */
export async function searchPlaces(
  query: string,
  options?: { foodBusinessesOnly?: boolean },
): Promise<FoodPlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || !GOOGLE_PLACES_API_KEY) return [];

  const body: Record<string, unknown> = {
    input: trimmed,
    languageCode: "en",
    includedRegionCodes: ["MY"],
    locationBias: {
      circle: {
        center: {
          latitude: DEFAULT_BIAS.latitude,
          longitude: DEFAULT_BIAS.longitude,
        },
        radius: DEFAULT_BIAS.radius,
      },
    },
  };

  if (options?.foodBusinessesOnly) {
    body.includedPrimaryTypes = FOOD_PRIMARY_TYPES;
  }

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
      body: JSON.stringify(body),
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

export function formatPlaceTypeLabel(
  type?: string,
  fallback = "Food business",
): string {
  if (!type) return fallback;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Roadmap snapshot with a pin — used for small chips only, not the hero card. */
export function buildGoogleStaticMapImageUrl(
  latitude: number,
  longitude: number,
  options?: { width?: number; height?: number; zoom?: number },
): string | null {
  if (!GOOGLE_PLACES_API_KEY) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const width = options?.width ?? 640;
  const height = options?.height ?? 320;
  const zoom = options?.zoom ?? 16;

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: "2",
    maptype: "roadmap",
    markers: `color:red|${latitude},${longitude}`,
    key: GOOGLE_PLACES_API_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function normalizePlaceId(placeId: string): string {
  return placeId.trim().replace(/^places\//, "");
}

/** Real photo of the place from Google Places (storefront, building, etc.). */
export async function fetchPlaceCoverPhotoUrl(
  placeId: string,
  maxWidth = 800,
  maxHeight = 400,
): Promise<string | null> {
  const normalizedId = normalizePlaceId(placeId);
  if (!GOOGLE_PLACES_API_KEY || !normalizedId) return null;

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedId)}`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "photos",
        },
      },
    );

    const data = (await response.json()) as {
      photos?: { name?: string }[];
      error?: { message?: string };
    };

    if (!response.ok || data.error?.message) return null;

    const photoName = data.photos?.[0]?.name;
    if (!photoName) return null;

    const mediaParams = new URLSearchParams({
      maxWidthPx: String(maxWidth),
      maxHeightPx: String(maxHeight),
      skipHttpRedirect: "true",
      key: GOOGLE_PLACES_API_KEY,
    });

    const mediaResponse = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?${mediaParams.toString()}`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        },
      },
    );

    const mediaData = (await mediaResponse.json()) as {
      photoUri?: string;
      error?: { message?: string };
    };

    if (!mediaResponse.ok || mediaData.error?.message) return null;
    return mediaData.photoUri?.trim() || null;
  } catch {
    return null;
  }
}

/** Street-level photo at coordinates when Google has panorama coverage. */
export async function fetchStreetViewImageUrl(
  latitude: number,
  longitude: number,
  options?: { width?: number; height?: number },
): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const width = options?.width ?? 640;
  const height = options?.height ?? 320;

  try {
    const metaParams = new URLSearchParams({
      location: `${latitude},${longitude}`,
      key: GOOGLE_PLACES_API_KEY,
    });
    const metaResponse = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?${metaParams.toString()}`,
    );
    const meta = (await metaResponse.json()) as { status?: string };
    if (meta.status !== "OK") return null;

    const viewParams = new URLSearchParams({
      size: `${width}x${height}`,
      location: `${latitude},${longitude}`,
      fov: "90",
      pitch: "5",
      key: GOOGLE_PLACES_API_KEY,
    });

    return `https://maps.googleapis.com/maps/api/streetview?${viewParams.toString()}`;
  } catch {
    return null;
  }
}

/** Prefer a real place photo, then street view — never a roadmap pin screenshot. */
export async function resolveSellerLocationHeroImage(
  latitude: number,
  longitude: number,
  placeId?: string,
): Promise<string | null> {
  if (placeId?.trim()) {
    const placePhoto = await fetchPlaceCoverPhotoUrl(placeId);
    if (placePhoto) return placePhoto;
  }

  return fetchStreetViewImageUrl(latitude, longitude);
}
