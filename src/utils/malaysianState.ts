import type { LocationGeocodedAddress } from "expo-location";

const STATE_ALIASES: Record<string, string> = {
  "wilayah persekutuan kuala lumpur": "kuala lumpur",
  "federal territory of kuala lumpur": "kuala lumpur",
  "wp kuala lumpur": "kuala lumpur",
  kl: "kuala lumpur",
  "wilayah persekutuan putrajaya": "putrajaya",
  "wilayah persekutuan labuan": "labuan",
  "pulau pinang": "penang",
  pinang: "penang",
  malacca: "melaka",
};

const STATE_KEYS = [
  "negeri sembilan",
  "kuala lumpur",
  "putrajaya",
  "labuan",
  "selangor",
  "penang",
  "johor",
  "kedah",
  "kelantan",
  "melaka",
  "pahang",
  "perak",
  "perlis",
  "sabah",
  "sarawak",
  "terengganu",
] as const;

export type MalaysianState = (typeof STATE_KEYS)[number];

/** Normalize a raw region / city / address fragment to a canonical state key. */
export function normalizeMalaysianState(raw: string): MalaysianState | null {
  const compact = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (!compact) return null;

  if (STATE_ALIASES[compact]) {
    return STATE_ALIASES[compact] as MalaysianState;
  }

  for (const key of STATE_KEYS) {
    if (compact === key || compact.includes(key)) {
      return key;
    }
  }

  return null;
}

/** Parse state from a comma-separated address (Google Places style). */
export function extractStateFromAddress(address: string): MalaysianState | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/malaysia/i.test(part));

  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 3); i--) {
    const state = normalizeMalaysianState(parts[i]);
    if (state) return state;
  }

  return normalizeMalaysianState(parts.join(" "));
}

/** Resolve state from an Expo reverse-geocode result. */
export function resolveStateFromGeocode(
  place: LocationGeocodedAddress,
): MalaysianState | null {
  const candidates = [
    place.region,
    place.subregion,
    place.city,
    place.district,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const candidate of candidates) {
    const state = normalizeMalaysianState(candidate);
    if (state) return state;
  }

  return null;
}

export function malaysianStatesMatch(
  a: MalaysianState | null,
  b: MalaysianState | null,
): boolean {
  return a != null && b != null && a === b;
}
