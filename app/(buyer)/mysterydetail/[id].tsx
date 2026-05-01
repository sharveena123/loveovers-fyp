import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    AvailableBag,
    getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { addToCart } from "@/src/services/firebase/cartServices";
import { colors, spacing } from "@/src/theme/styles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart, Lightbulb, Share2, Star, Zap } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

export default function MysteryBagDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [bag, setBag] = useState<AvailableBag | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const loadBagDetails = useCallback(async () => {
    try {
      setLoading(true);
      const allBags = await getAvailableBags({
        latitude: 3.139,
        longitude: 101.6869,
      });
      const foundBag = allBags.find((b) => b.id === id);
      if (foundBag) {
        setBag(foundBag);
      }
    } catch (error) {
      console.error("Error loading bag details:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBagDetails();
  }, [loadBagDetails]);

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to add items to cart", [
        { text: "Cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }

    if (!bag) return;

    try {
      setAddingToCart(true);
      await addToCart(user.uid, {
        id: bag.id || "",
        name: bag.name || "",
        sellerName: bag.sellerName || "",
        sellerId: bag.sellerId || "",
        price: bag.discountedPrice || bag.price || 0,
        originalPrice: bag.originalPrice,
        quantity: selectedQuantity,
        imageUrl: bag.imageUrl,
        type: bag.type || "bag",
      });

      // Show success message and reset
      Alert.alert(
        "Success",
        `Added ${selectedQuantity} mystery bag(s) to cart`,
        [
          {
            text: "Continue Shopping",
            onPress: () => {
              setShowQuantityModal(false);
              setSelectedQuantity(1);
            },
          },
          {
            text: "Go to Cart",
            onPress: () => {
              setShowQuantityModal(false);
              setSelectedQuantity(1);
              router.push("/(buyer)/buyercart");
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Failed to add mystery bag to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const calculateDiscount = (original: number, discounted: number) =>
    Math.round(((original - discounted) / original) * 100);

  const getLeftCount = (item: AvailableBag) => item.quantity - (item.sold || 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 200 }}
        />
      </SafeAreaView>
    );
  }

  if (!bag) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Mystery bag not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const discount = calculateDiscount(
    bag.originalPrice || bag.price,
    bag.discountedPrice || bag.price,
  );
  const leftCount = getLeftCount(bag);
  const originalValue = (bag.originalPrice || bag.price) * 2; // Mystery bags typically have 2x value

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Heart
              size={24}
              color={isFavorite ? colors.primary : colors.textSoft}
              fill={isFavorite ? colors.primary : "none"}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={24} color={colors.textSoft} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Mystery Bag Image */}
        <View style={styles.imageContainer}>
          {bag.imageUrl ? (
            <Image source={{ uri: bag.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={styles.mysteryBox}>
                <Text style={styles.mysteryIcon}>🎁</Text>
              </View>
            </View>
          )}
          {/* Badge - Mystery */}
          <View style={styles.mysteryBadge}>
            <Lightbulb size={16} color={colors.white} />
            <Text style={styles.mysteryBadgeText}>Mystery Inside</Text>
          </View>
          {/* Limited Quantity badge */}
          {leftCount <= 3 && leftCount > 0 && (
            <View style={styles.urgentBadge}>
              <Zap size={14} color={colors.white} />
              <Text style={styles.urgentText}>Last {leftCount}!</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Excitement Section */}
          <View style={styles.excitementCard}>
            <Text style={styles.bagName}>{bag.name}</Text>
            <Text style={styles.tagline}>
              🎉 Unknown contents • {bag.category}
            </Text>

            {/* Price Highlight */}
            <View style={styles.priceHighlight}>
              <View>
                <Text style={styles.bargainLabel}>You Pay</Text>
                <Text style={styles.discountedPrice}>
                  RM {(bag.discountedPrice || bag.price).toFixed(2)}
                </Text>
              </View>
              <View style={styles.priceDivider} />
              <View>
                <Text style={styles.bargainLabel}>Worth Up To</Text>
                <Text style={styles.originalValuePrice}>
                  RM {originalValue.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Savings Badge */}
            {discount > 0 && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  Save up to{" "}
                  {(
                    ((originalValue - (bag.discountedPrice || bag.price)) /
                      originalValue) *
                    100
                  ).toFixed(0)}
                  %! 🚀
                </Text>
              </View>
            )}
          </View>

          {/* What's Inside Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Lightbulb size={20} color={colors.primary} />
              <Text style={styles.infoTitle}>What&apos;s Inside?</Text>
            </View>
            <Text style={styles.infoDescription}>
              This bag contains carefully curated items from {bag.sellerName}.
              It&apos;s a delightful surprise! 🌟
            </Text>
            {bag.description && (
              <Text style={styles.infoDescriptionExtra}>{bag.description}</Text>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>⏰</Text>
              <Text style={styles.statLabel}>Expires</Text>
              <Text style={styles.statValue}>{bag.expiryDate}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>📍</Text>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{bag.distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statValue}>{bag.rating.toFixed(1)}</Text>
            </View>
          </View>

          {/* Seller Info */}
          <View style={styles.sellerSection}>
            <Text style={styles.sectionTitle}>From This Seller</Text>
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>
                  {bag.sellerName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{bag.sellerName}</Text>
                <View style={styles.sellerRating}>
                  <Star size={12} color="#FFC107" fill="#FFC107" />
                  <Text style={styles.sellerRatingText}>
                    {bag.rating.toFixed(1)} (
                    {Math.floor(Math.random() * 100) + 10} reviews)
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.messageButton}>
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Why Choose Mystery Bags */}
          <View style={styles.benefitsCard}>
            <Text style={styles.sectionTitle}>Why Mystery Bags?</Text>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>💚</Text>
              <Text style={styles.benefitText}>Help reduce food waste</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitText}>
                Save up to 70% on food costs
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>🎉</Text>
              <Text style={styles.benefitText}>Every bag is a surprise!</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>⚡</Text>
              <Text style={styles.benefitText}>Support local businesses</Text>
            </View>
          </View>

          {/* Availability */}
          <View style={styles.availabilityCard}>
            {leftCount > 0 ? (
              <>
                <Text style={styles.availabilityText}>
                  Only {leftCount} bag{leftCount > 1 ? "s" : ""} left!
                </Text>
                <Text style={styles.availabilitySubtext}>
                  Act fast before they&apos;re gone
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.soldOutText}>Sold Out</Text>
                <Text style={styles.availabilitySubtext}>
                  Check back soon for more surprises!
                </Text>
              </>
            )}
          </View>

          {/* CTA Buttons */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              style={[
                styles.addToCartButton,
                leftCount === 0 && styles.addToCartButtonDisabled,
              ]}
              disabled={leftCount === 0 || addingToCart}
              onPress={() => setShowQuantityModal(true)}
            >
              <Text style={styles.addToCartText}>
                {leftCount === 0
                  ? "Sold Out"
                  : addingToCart
                    ? "Adding..."
                    : "Grab This Mystery Bag! 🎁"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Quantity Modal */}
      <Modal
        visible={showQuantityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How Many Bags?</Text>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quantitySelectorSection}>
              <View style={styles.quantityControlLarge}>
                <TouchableOpacity
                  disabled={selectedQuantity <= 1}
                  onPress={() =>
                    setSelectedQuantity(Math.max(1, selectedQuantity - 1))
                  }
                  style={styles.quantityButtonLarge}
                >
                  <Text style={styles.quantityButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.quantityDisplayLarge}>
                  {selectedQuantity}
                </Text>
                <TouchableOpacity
                  disabled={selectedQuantity >= leftCount}
                  onPress={() =>
                    setSelectedQuantity(
                      Math.min(leftCount, selectedQuantity + 1),
                    )
                  }
                  style={styles.quantityButtonLarge}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.availableText}>
                {leftCount} bags available
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalAddButton}
              disabled={addingToCart}
              onPress={handleAddToCart}
            >
              <Text style={styles.modalAddButtonText}>
                {addingToCart ? "Adding..." : "Add to Cart"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              disabled={addingToCart}
              onPress={() => setShowQuantityModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    width: "100%",
    height: 350,
    position: "relative",
    backgroundColor: colors.primarySoft,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  mysteryBox: {
    width: 120,
    height: 120,
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mysteryIcon: {
    fontSize: 60,
  },
  mysteryBadge: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mysteryBadgeText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  urgentBadge: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  urgentText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  excitementCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  bagName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSoft,
    marginBottom: spacing.lg,
  },
  priceHighlight: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  bargainLabel: {
    fontSize: 12,
    color: colors.textSoft,
    marginBottom: 4,
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
  },
  originalValuePrice: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.success,
  },
  priceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  savingsBadge: {
    backgroundColor: "#FFE0E0",
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  savingsText: {
    color: "#C92A1E",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  infoDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  infoDescriptionExtra: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSoft,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  sellerSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  sellerCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  sellerInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  sellerRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sellerRatingText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  messageButton: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  messageButtonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  benefitsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  benefitIcon: {
    fontSize: 18,
  },
  benefitText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  availabilityCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#FFC107",
  },
  availabilityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E67E22",
    marginBottom: 4,
  },
  soldOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textSoft,
    marginBottom: 4,
  },
  availabilitySubtext: {
    fontSize: 12,
    color: "#E67E22",
  },
  ctaContainer: {
    gap: spacing.md,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  addToCartButtonDisabled: {
    backgroundColor: colors.textSoft,
    opacity: 0.5,
  },
  addToCartText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalClose: {
    fontSize: 24,
    color: colors.textSoft,
  },
  quantitySelectorSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  quantityControlLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  quantityButtonLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.primary,
  },
  quantityDisplayLarge: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    minWidth: 50,
    textAlign: "center",
  },
  availableText: {
    fontSize: 13,
    color: colors.textSoft,
  },
  modalAddButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalAddButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
