import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    AvailableBag,
    getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { addToCart } from "@/src/services/firebase/cartServices";
import { colors, spacing } from "@/src/theme/styles";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Clock,
    Heart,
    MapPin,
    Share2,
    Star,
    TrendingDown,
} from "lucide-react-native";
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

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [bag, setBag] = useState<AvailableBag | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const loadBagDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all bags and find the one with matching ID
      // In a real app, you'd have a dedicated function to fetch single bag
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
        type: bag.type || "item",
      });

      // Show success message and reset
      Alert.alert("Success", `Added ${selectedQuantity} item(s) to cart`, [
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
      ]);
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Failed to add item to cart");
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
          <Text style={styles.emptyText}>Item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const discount = calculateDiscount(
    bag.originalPrice || bag.price,
    bag.discountedPrice || bag.price,
  );
  const leftCount = getLeftCount(bag);

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
        {/* Image */}
        <View style={styles.imageContainer}>
          {bag.imageUrl ? (
            <Image source={{ uri: bag.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>
                {bag.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <TrendingDown size={16} color={colors.white} />
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          {leftCount <= 5 && leftCount > 0 && (
            <View style={styles.limitedBadge}>
              <Text style={styles.limitedText}>Limited</Text>
            </View>
          )}
        </View>

        {/* Item Info */}
        <View style={styles.content}>
          {/* Name & Rating */}
          <View style={styles.headerInfo}>
            <View style={styles.nameSection}>
              <Text style={styles.itemName}>{bag.name}</Text>
              <Text style={styles.category}>{bag.category}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Star size={16} color="#FFC107" fill="#FFC107" />
              <Text style={styles.ratingText}>{bag.rating.toFixed(1)}</Text>
            </View>
          </View>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <View>
              <Text style={styles.discountedPrice}>
                RM {(bag.discountedPrice || bag.price).toFixed(2)}
              </Text>
              {bag.originalPrice &&
                bag.originalPrice > (bag.discountedPrice || bag.price) && (
                  <Text style={styles.originalPrice}>
                    RM {bag.originalPrice.toFixed(2)}
                  </Text>
                )}
            </View>
            <View style={styles.leftBadge}>
              <Text style={styles.leftText}>{leftCount} left</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Seller Info */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>
                  {bag.sellerName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sellerDetails}>
                <Text style={styles.sellerName}>{bag.sellerName}</Text>
                <View style={styles.sellerRating}>
                  <Star size={12} color="#FFC107" fill="#FFC107" />
                  <Text style={styles.sellerRatingText}>
                    {bag.rating.toFixed(1)} (
                    {Math.floor(Math.random() * 100) + 10} reviews)
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.contactButton}>
              <Text style={styles.contactButtonText}>Contact</Text>
            </TouchableOpacity>
          </View>

          {/* Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Details</Text>

            {/* Quantity */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Available:</Text>
              <Text style={styles.detailValue}>{leftCount} items</Text>
            </View>

            {/* Expiry */}
            <View style={styles.detailRow}>
              <Clock size={16} color={colors.textSoft} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Expires:</Text>
                <Text style={styles.detailValue}>{bag.expiryDate}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.detailRow}>
              <MapPin size={16} color={colors.textSoft} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Pickup Location:</Text>
                <Text style={styles.detailValue}>
                  ~{bag.distance.toFixed(1)} km away
                </Text>
              </View>
            </View>

            {/* Type */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailValue}>
                {bag.type === "bag" ? "Mystery Bag" : "Individual Item"}
              </Text>
            </View>
          </View>

          {/* Description */}
          {bag.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About this {bag.type}</Text>
              <Text style={styles.description}>{bag.description}</Text>
            </View>
          )}

          {/* CTA Buttons */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              style={styles.addToCartButton}
              disabled={leftCount === 0 || addingToCart}
              onPress={() => setShowQuantityModal(true)}
            >
              <Text style={styles.addToCartText}>
                {leftCount === 0
                  ? "Sold Out"
                  : addingToCart
                    ? "Adding..."
                    : "Add to Cart"}
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
              <Text style={styles.modalTitle}>Select Quantity</Text>
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
                {leftCount} items available
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
  imagePlaceholderText: {
    fontSize: 80,
    fontWeight: "700",
    color: colors.primary,
    opacity: 0.3,
  },
  discountBadge: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discountText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  limitedBadge: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  limitedText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 12,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  nameSection: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: colors.textSoft,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  discountedPrice: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  leftBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  leftText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  sellerCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
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
  sellerDetails: {
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
  contactButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  contactButtonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 12,
  },
  detailsSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRow_last: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSoft,
    minWidth: 80,
  },
  detailContent: {
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  descriptionSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
