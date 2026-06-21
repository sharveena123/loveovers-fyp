import { Text } from "@/src/components/StyledText";
import { FieldError } from "@/src/components/FieldError";
import {
  fetchFoodPlaceDetails,
  formatPlaceTypeLabel,
  hasGooglePlacesApiKey,
  searchFoodPlaces,
  searchPlaces,
  type FoodPlaceDetails,
  type FoodPlaceSuggestion,
} from "@/src/services/places/googlePlaces";
import { colors, spacing } from "@/src/theme/styles";
import { MapPin, Search } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type SelectedFoodPlace = FoodPlaceDetails;

type FoodBusinessAddressFieldProps = {
  query: string;
  onQueryChange: (text: string) => void;
  selectedPlace: SelectedFoodPlace | null;
  onPlaceSelected: (place: SelectedFoodPlace | null) => void;
  disabled?: boolean;
  manualMode?: boolean;
  /** When true, only Google Places picker is allowed (no manual text fallback). */
  requireGooglePlace?: boolean;
  error?: string;
};

export function FoodBusinessAddressField({
  query,
  onQueryChange,
  selectedPlace,
  onPlaceSelected,
  disabled,
  manualMode,
  requireGooglePlace,
  error,
}: FoodBusinessAddressFieldProps) {
  const [suggestions, setSuggestions] = useState<FoodPlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [showList, setShowList] = useState(false);

  const placeTypeFallback = manualMode ? "Pickup location" : "Food business";
  const label = manualMode
    ? "Pickup location on Google Maps *"
    : "Find your business on Google *";
  const hint = requireGooglePlace
    ? "Search and select a location from the Google Maps list — typed addresses alone are not accepted."
    : manualMode
      ? "Search any valid address, neighbourhood, or landmark — does not need to be a café or shop."
      : "Search cafés, bakeries, restaurants, and food shops in Malaysia.";
  const placeholder = manualMode
    ? "Type area, street, or landmark…"
    : "Type café, bakery, or restaurant name…";

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!hasGooglePlacesApiKey()) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = manualMode
          ? await searchPlaces(trimmed)
          : await searchFoodPlaces(trimmed);
        if (!cancelled) {
          setSuggestions(results);
          setShowList(true);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, manualMode, disabled]);

  const handleSelect = async (item: FoodPlaceSuggestion) => {
    setShowList(false);
    setLoadingPlace(true);
    try {
      const details = await fetchFoodPlaceDetails(item.placeId);
      if (details) {
        onQueryChange(details.formattedAddress);
        onPlaceSelected(details);
      }
    } finally {
      setLoadingPlace(false);
    }
  };

  const clearSelection = () => {
    onPlaceSelected(null);
    setShowList(true);
  };

  if (!hasGooglePlacesApiKey()) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.warn}>
          {requireGooglePlace
            ? "Google Maps place search is required to set your location. Places API is not configured — contact support."
            : "Places API key missing — type your full address manually below."}
        </Text>
        {!requireGooglePlace ? (
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={query}
            onChangeText={(text) => {
              onQueryChange(text);
              onPlaceSelected(null);
            }}
            placeholder={
              manualMode
                ? "e.g. 12, Jalan Example, Taman Connaught, Cheras"
                : "Full business address"
            }
            placeholderTextColor={colors.textSoft}
            editable={!disabled}
          />
        ) : null}
        <FieldError message={error} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>

      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <Search size={18} color={colors.textSoft} />
        <TextInput
          style={styles.inputFlex}
          value={query}
          onChangeText={(text) => {
            onQueryChange(text);
            if (selectedPlace) onPlaceSelected(null);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          editable={!disabled && !loadingPlace}
        />
        {(searching || loadingPlace) && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>

      {selectedPlace ? (
        <View style={styles.selectedCard}>
          <MapPin size={18} color={colors.primary} />
          <View style={styles.selectedText}>
            <Text style={styles.selectedName} numberOfLines={2}>
              {selectedPlace.displayName || selectedPlace.formattedAddress}
            </Text>
            <Text style={styles.selectedMeta} numberOfLines={2}>
              {formatPlaceTypeLabel(
                selectedPlace.primaryType,
                placeTypeFallback,
              )}{" "}
              · {selectedPlace.formattedAddress}
            </Text>
          </View>
          <TouchableOpacity onPress={clearSelection} disabled={disabled}>
            <Text style={styles.changeLink}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showList && suggestions.length > 0 && !selectedPlace ? (
        <View style={styles.list}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={styles.listItem}
              onPress={() => handleSelect(item)}
              activeOpacity={0.85}
            >
              <MapPin size={16} color={colors.primary} />
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle} numberOfLines={2}>
                  {item.label}
                </Text>
                <Text style={styles.listItemSub}>
                  {formatPlaceTypeLabel(item.primaryType, placeTypeFallback)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {requireGooglePlace &&
      !selectedPlace &&
      query.trim().length >= 2 &&
      !searching &&
      !loadingPlace ? (
        <Text style={styles.pickHint}>
          {suggestions.length === 0
            ? "No Google Maps matches — try a nearby street, area, or landmark."
            : "Select a result from the list above to confirm your location."}
        </Text>
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, zIndex: 10 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textSoft, marginBottom: spacing.sm },
  warn: { fontSize: 12, color: colors.error, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  inputRowError: {
    borderColor: colors.error,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.2)",
  },
  selectedText: { flex: 1 },
  selectedName: { fontSize: 15, fontWeight: "700", color: colors.text },
  selectedMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  changeLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
  list: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    maxHeight: 220,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemText: { flex: 1 },
  listItemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  listItemSub: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  pickHint: {
    fontSize: 12,
    color: colors.textSoft,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
});
