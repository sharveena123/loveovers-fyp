import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_KEY = "buyer.preferredLocation";
const RECENT_LOCATIONS_KEY = "buyer.recentLocations";
const MAX_RECENT_LOCATIONS = 6;

export interface PreferredLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export const savePreferredLocation = async (
  location: PreferredLocation,
): Promise<void> => {
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
};

export const getPreferredLocation =
  async (): Promise<PreferredLocation | null> => {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as PreferredLocation;

      const latitude = Number(parsed.latitude);
      const longitude = Number(parsed.longitude);
      const label = typeof parsed.label === "string" ? parsed.label : "";

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) {
        return null;
      }

      return {
        latitude,
        longitude,
        label,
      };
    } catch {
      return null;
    }
  };

export const getRecentLocations = async (): Promise<PreferredLocation[]> => {
  const raw = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as PreferredLocation[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        label: typeof item.label === "string" ? item.label : "",
      }))
      .filter(
        (item) =>
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude) &&
          item.label.length > 0,
      )
      .slice(0, MAX_RECENT_LOCATIONS);
  } catch {
    return [];
  }
};

export const addRecentLocation = async (
  location: PreferredLocation,
): Promise<PreferredLocation[]> => {
  const existing = await getRecentLocations();
  const deduped = existing.filter(
    (item) => item.label.toLowerCase() !== location.label.toLowerCase(),
  );

  const next = [location, ...deduped].slice(0, MAX_RECENT_LOCATIONS);
  await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
  return next;
};
