import { Text, TextInput } from "@/src/components/StyledText";
import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { BuyerStats, getBuyerStats } from "@/src/services/firebase/buyerStats";
import { auth } from "@/src/services/firebase/config";
import { colors, spacing } from "@/src/theme/styles";
import { router } from "expo-router";
import {
  Clock,
  MapPin,
  Search,
  Star,
  TrendingDown,
  User,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export default function BuyerHome() {
  const [stats, setStats] = useState<BuyerStats | null>(null);
  const [bags, setBags] = useState<AvailableBag[]>([]);
  const [filteredBags, setFilteredBags] = useState<AvailableBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("Brickfields, KL");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterBags();
  }, [bags, searchQuery]);

  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    setLoading(true);
    try {
      const [buyerStats, availableBags] = await Promise.all([
        getBuyerStats(user.uid),
        getAvailableBags(),
      ]);

      setStats(buyerStats);
      setBags(availableBags);
      setFilteredBags(availableBags);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterBags = () => {
    if (!searchQuery.trim()) {
      setFilteredBags(bags);
      return;
    }

    const filtered = bags.filter(
      (bag) =>
        bag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bag.sellerName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredBags(filtered);
  };

  const calculateDiscount = (original: number, discounted: number) => {
    return Math.round(((original - discounted) / original) * 100);
  };

  const formatTime = (timeString: string) => {
    return timeString || "N/A";
  };

  const getLeftCount = (item: AvailableBag) => {
    return item.quantity - (item.sold || 0);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.locationLabel}>Location</Text>
          <View style={styles.locationRow}>
            <MapPin size={20} color={colors.white} />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <User size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textSoft} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cafes, bakeries..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSoft}
          />
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats?.bagsSaved || 0}</Text>
            <Text style={styles.statLabel}>Bags Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              RM {stats?.moneySaved.toFixed(0) || 0}
            </Text>
            <Text style={styles.statLabel}>Money Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats?.co2Saved || 0} kg</Text>
            <Text style={styles.statLabel}>CO₂ Saved</Text>
          </View>
        </View>

        {/* Available Near You */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Near You</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {filteredBags.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No bags available nearby</Text>
              <Text style={styles.emptySubtext}>
                Check back later for new listings!
              </Text>
            </View>
          ) : (
            filteredBags.map((bag, index) => {
              const leftCount = getLeftCount(bag);
              const discount = calculateDiscount(
                bag.originalPrice || bag.price,
                bag.discountedPrice || bag.price,
              );

              return (
                <TouchableOpacity key={bag.id || index} style={styles.bagCard}>
                  {/* Image */}
                  <View style={styles.bagImageContainer}>
                    {bag.imageUrl ? (
                      <Image
                        source={{ uri: bag.imageUrl }}
                        style={styles.bagImage}
                      />
                    ) : (
                      <View style={styles.bagImagePlaceholder}>
                        <Text style={styles.bagImagePlaceholderText}>
                          {bag.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {discount > 0 && (
                      <View style={styles.discountBadge}>
                        <TrendingDown size={12} color={colors.white} />
                        <Text style={styles.discountText}>-{discount}%</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.bagInfo}>
                    <Text style={styles.bagName}>{bag.sellerName}</Text>

                    <View style={styles.bagMeta}>
                      <Star size={14} color="#FFC107" fill="#FFC107" />
                      <Text style={styles.ratingText}>
                        {bag.rating.toFixed(1)}
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <MapPin size={14} color={colors.textSoft} />
                      <Text style={styles.distanceText}>
                        {bag.distance.toFixed(1)} km
                      </Text>
                    </View>

                    <View style={styles.bagTime}>
                      <Clock size={14} color={colors.textSoft} />
                      <Text style={styles.timeText}>
                        {formatTime(bag.expiryDate)}
                      </Text>
                    </View>

                    <View style={styles.bagFooter}>
                      <View>
                        <Text style={styles.price}>
                          RM {(bag.discountedPrice || bag.price).toFixed(2)}
                        </Text>
                        {bag.originalPrice &&
                          bag.originalPrice >
                            (bag.discountedPrice || bag.price) && (
                            <Text style={styles.originalPrice}>
                              ${bag.originalPrice.toFixed(2)}
                            </Text>
                          )}
                      </View>
                      <View style={styles.leftBadge}>
                        <Text style={styles.leftText}>{leftCount} left</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Impact Card */}
        <View style={styles.impactCard}>
          <View style={styles.impactIcon}>
            <Text style={styles.impactEmoji}>📊</Text>
          </View>
          <View style={styles.impactContent}>
            <Text style={styles.impactTitle}>Your Impact This Month</Text>
            <Text style={styles.impactText}>
              You've saved {stats?.bagsSaved || 0} meals from going to waste and
              prevented {stats?.co2Saved || 0}kg of CO₂ emissions!
            </Text>
            <TouchableOpacity style={styles.detailsButton}>
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.white,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  statsCard: {
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  bagCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
  },
  bagImageContainer: {
    width: 120,
    height: 140,
    position: "relative",
  },
  bagImage: {
    width: "100%",
    height: "100%",
  },
  bagImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  bagImagePlaceholderText: {
    fontSize: 48,
    fontWeight: "600",
    color: colors.primary,
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discountText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
  bagInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  bagName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  bagMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
  metaDot: {
    fontSize: 13,
    color: colors.textSoft,
  },
  distanceText: {
    fontSize: 13,
    color: colors.textSoft,
  },
  bagTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 13,
    color: colors.textSoft,
  },
  bagFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  leftBadge: {
    backgroundColor: colors.errorSoft,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.error,
  },
  leftText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
  },
  impactCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  impactIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
  impactEmoji: {
    fontSize: 28,
  },
  impactContent: {
    flex: 1,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  impactText: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  detailsButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSoft,
  },
});
