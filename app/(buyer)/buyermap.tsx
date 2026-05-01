import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { colors } from "@/src/theme/styles";
import { getPreferredLocation } from "@/src/utils/locationPreference";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";

export default function BuyerMap() {
  const [bags, setBags] = useState<AvailableBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState({
    latitude: 3.139,
    longitude: 101.6869,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const validBags = bags.filter((bag) => {
    const lat = Number(bag.latitude);
    const lng = Number(bag.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  const initMap = useCallback(async () => {
    try {
      const preferredLocation = await getPreferredLocation();

      // 1️⃣ Use selected location if available, otherwise device location
      const loc = preferredLocation
        ? {
            latitude: preferredLocation.latitude,
            longitude: preferredLocation.longitude,
          }
        : await getLocation();

      setRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // 2️⃣ Fetch nearby cafes / bags
      const nearbyBags = await getAvailableBags(loc);
      setBags(nearbyBags);

      if (nearbyBags.length > 0) {
        const first = nearbyBags[0];
        const firstLat = Number(first.latitude);
        const firstLng = Number(first.longitude);

        if (Number.isFinite(firstLat) && Number.isFinite(firstLng)) {
          setRegion({
            latitude: firstLat,
            longitude: firstLng,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          });
        }
      }
    } catch (err) {
      console.error("Error loading map data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initMap();
  }, [initMap]);

  const getLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { latitude: 3.139, longitude: 101.6869 };
    const loc = await Location.getCurrentPositionAsync({});
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  };

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

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webFallback}>
          <Text style={styles.webTitle}>Map is not available on web.</Text>
          <Text style={styles.webText}>
            Please open this screen on Android or iOS to view nearby sellers.
          </Text>
          <Text style={styles.webText}>Nearby bags found: {bags.length}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (validBags.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webFallback}>
          <Text style={styles.webTitle}>No seller locations found yet.</Text>
          <Text style={styles.webText}>
            Ask a seller to set a detailed business address.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {validBags.map((bag) => (
          <Marker
            key={bag.id}
            coordinate={{
              latitude: Number(bag.latitude),
              longitude: Number(bag.longitude),
            }}
            title={bag.sellerName}
            description={`Stock: ${bag.quantity - (bag.sold || 0)} | RM ${bag.discountedPrice || bag.price}`}
          >
            <Callout>
              <View style={{ width: 150 }}>
                <Text style={{ fontWeight: "600" }}>{bag.sellerName}</Text>
                <Text>Stock: {bag.quantity - (bag.sold || 0)}</Text>
                <Text>
                  Price: RM {(bag.discountedPrice || bag.price).toFixed(2)}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  webTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111",
    textAlign: "center",
  },
  webText: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    marginBottom: 6,
  },
});
