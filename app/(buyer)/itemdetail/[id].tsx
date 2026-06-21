import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  AvailableBag,
  getAvailableBags,
} from "@/src/services/firebase/buyerInventory";
import { addToCart } from "@/src/services/firebase/cartServices";
import {
  createConversation,
  getBuyerDisplayNameForUser,
} from "@/src/services/firebase/messagingServices";
import { colors, spacing } from "@/src/theme/styles";
import { getPreferredLocation } from "@/src/utils/locationPreference";
import { resolveBuyerPriceDisplay } from "@/src/utils/listingPrices";
import { BUYER_ROUTES, goBackToReturn, pushWithReturn } from "@/src/utils/navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Clock,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
  Star,
  Tag,
  TrendingDown,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const DEFAULT_LAT = 3.139;
const DEFAULT_LNG = 101.6869;
const IMAGE_HEIGHT = 340;

function getLeftCount(item: AvailableBag) {
  return Math.max(0, item.quantity - (item.sold || 0));
}

export default function ItemDetail() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.home);
  const [bag, setBag] = useState<AvailableBag | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [contacting, setContacting] = useState(false);

  const loadBagDetails = useCallback(async () => {
    try {
      setLoading(true);
      const preferred = await getPreferredLocation();
      const allBags = await getAvailableBags({
        latitude: preferred?.latitude ?? DEFAULT_LAT,
        longitude: preferred?.longitude ?? DEFAULT_LNG,
        locationLabel: preferred?.label,
      });
      const foundBag = allBags.find((b) => b.id === id);
      if (foundBag) setBag(foundBag);
    } catch (error) {
      console.error("Error loading item details:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBagDetails();
  }, [loadBagDetails]);

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert("Login required", "Please log in to add items to your cart", [
        { text: "Cancel", style: "cancel" },
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
        price: resolveBuyerPriceDisplay(bag).salePrice,
        originalPrice: resolveBuyerPriceDisplay(bag).retail,
        quantity: selectedQuantity,
        imageUrl: bag.imageUrl,
        type: bag.type || "item",
      });

      Alert.alert(
        "Added to cart",
        `${selectedQuantity} × ${bag.name} added successfully.`,
        [
          {
            text: "Keep shopping",
            onPress: () => {
              setShowQuantityModal(false);
              setSelectedQuantity(1);
            },
          },
          {
            text: "View cart",
            onPress: () => {
              setShowQuantityModal(false);
              setSelectedQuantity(1);
              pushWithReturn(router, "/(buyer)/buyercart", BUYER_ROUTES.home);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Failed to add item to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleContact = async () => {
    if (!user) {
      Alert.alert("Login required", "Please log in to message the seller", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }
    if (!bag?.sellerId) return;

    try {
      setContacting(true);
      const buyerName = await getBuyerDisplayNameForUser(
        user.uid,
        user.displayName,
      );

      const convId = await createConversation(
        user.uid,
        buyerName,
        bag.sellerId,
        bag.sellerName || "Seller",
      );
      pushWithReturn(
        router,
        `/(buyer)/chat/${convId}`,
        BUYER_ROUTES.home,
      );
    } catch (error) {
      console.error("Error starting conversation:", error);
      Alert.alert("Error", "Could not open chat with seller");
    } finally {
      setContacting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading item…</Text>
        </View>
      </View>
    );
  }

  if (!bag) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Item not found</Text>
          <Text style={styles.emptySub}>
            This deal may have sold out or been removed.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleBack}
          >
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const prices = resolveBuyerPriceDisplay(bag);
  const price = prices.salePrice;
  const original = prices.retail;
  const discount = prices.discountPct;
  const compareAt = prices.compareAtPrice;
  const leftCount = getLeftCount(bag);
  const soldOut = leftCount === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          {bag.imageUrl ? (
            <Image source={{ uri: bag.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroInitial}>
                {bag.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroOverlay} />

          <SafeAreaView style={styles.floatingHeader}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleBack}
            >
              <ArrowLeft size={22} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setIsFavorite(!isFavorite)}
              >
                <Heart
                  size={20}
                  color={colors.white}
                  fill={isFavorite ? colors.white : "transparent"}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Share2 size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {discount > 0 && (
            <View style={styles.discountPill}>
              <TrendingDown size={14} color={colors.white} />
              <Text style={styles.discountPillText}>{discount}% off</Text>
            </View>
          )}
          {leftCount > 0 && leftCount <= 5 && (
            <View style={styles.limitedPill}>
              <Text style={styles.limitedPillText}>Only {leftCount} left</Text>
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              {bag.category ? (
                <View style={styles.categoryChip}>
                  <Tag size={12} color={colors.primary} />
                  <Text style={styles.categoryText}>{bag.category}</Text>
                </View>
              ) : null}
              <Text style={styles.itemName}>{bag.name}</Text>
            </View>
            <View style={styles.ratingPill}>
              <Star size={14} color="#FFC107" fill="#FFC107" />
              <Text style={styles.ratingText}>{bag.rating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>RM {price.toFixed(2)}</Text>
            {compareAt != null && (
              <Text style={styles.originalPrice}>RM {compareAt.toFixed(2)}</Text>
            )}
          </View>

          {discount > 0 && (
            <View style={styles.saveBanner}>
              <Leaf size={16} color={colors.success} />
              <Text style={styles.saveBannerText}>
                You save RM {(original - price).toFixed(2)} on this item
              </Text>
            </View>
          )}

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitial}>
                {bag.sellerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>Sold by</Text>
              <Text style={styles.sellerName}>{bag.sellerName}</Text>
              <View style={styles.sellerRating}>
                <Star size={12} color="#FFC107" fill="#FFC107" />
                <Text style={styles.sellerRatingText}>
                  {bag.rating.toFixed(1)} rating
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={handleContact}
              disabled={contacting}
            >
              <MessageCircle size={16} color={colors.primary} />
              <Text style={styles.messageBtnText}>
                {contacting ? "…" : "Chat"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Pickup details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Clock size={18} color={colors.primary} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Expires</Text>
                <Text style={styles.detailValue}>{bag.expiryDate}</Text>
              </View>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MapPin size={18} color={colors.primary} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>
                  ~{bag.distance.toFixed(1)} km away
                </Text>
              </View>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <ShoppingCart size={18} color={colors.primary} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Available</Text>
                <Text style={styles.detailValue}>
                  {soldOut ? "Sold out" : `${leftCount} remaining`}
                </Text>
              </View>
            </View>
          </View>

          {bag.description ? (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.aboutCard}>
                <Text style={styles.description}>{bag.description}</Text>
              </View>
            </>
          ) : null}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <SafeAreaView style={styles.footer}>
        <View style={styles.footerInner}>
          <View>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerPrice}>RM {price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, soldOut && styles.addBtnDisabled]}
            disabled={soldOut || addingToCart}
            onPress={() => setShowQuantityModal(true)}
            activeOpacity={0.9}
          >
            <ShoppingCart size={20} color={colors.white} />
            <Text style={styles.addBtnText}>
              {soldOut ? "Sold out" : "Add to cart"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={showQuantityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowQuantityModal(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quantity</Text>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <X size={22} color={colors.textSoft} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalItemName} numberOfLines={2}>
              {bag.name}
            </Text>
            <Text style={styles.modalPrice}>RM {price.toFixed(2)} each</Text>

            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[
                  styles.qtyBtn,
                  selectedQuantity <= 1 && styles.qtyBtnDisabled,
                ]}
                disabled={selectedQuantity <= 1}
                onPress={() =>
                  setSelectedQuantity(Math.max(1, selectedQuantity - 1))
                }
              >
                <Minus size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{selectedQuantity}</Text>
              <TouchableOpacity
                style={[
                  styles.qtyBtn,
                  selectedQuantity >= leftCount && styles.qtyBtnDisabled,
                ]}
                disabled={selectedQuantity >= leftCount}
                onPress={() =>
                  setSelectedQuantity(
                    Math.min(leftCount, selectedQuantity + 1),
                  )
                }
              >
                <Plus size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qtyHint}>{leftCount} available</Text>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Subtotal</Text>
              <Text style={styles.modalTotalValue}>
                RM {(price * selectedQuantity).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalAddBtn}
              disabled={addingToCart}
              onPress={handleAddToCart}
            >
              <Text style={styles.modalAddBtnText}>
                {addingToCart ? "Adding…" : "Add to cart"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textSoft },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptySub: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
    marginTop: spacing.sm,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: colors.white },
  scrollContent: { paddingBottom: 0 },
  hero: {
    height: IMAGE_HEIGHT,
    backgroundColor: colors.primarySoft,
    position: "relative",
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitial: {
    fontSize: 72,
    fontWeight: "800",
    color: colors.primary,
    opacity: 0.35,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    zIndex: 2,
  },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  discountPill: {
    position: "absolute",
    bottom: 36,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  discountPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.white,
  },
  limitedPill: {
    position: "absolute",
    bottom: 36,
    right: spacing.lg,
    backgroundColor: "#E53935",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  limitedPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.white,
  },
  sheet: {
    marginTop: -24,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  titleBlock: { flex: 1 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  itemName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 32,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  ratingText: { fontSize: 14, fontWeight: "800", color: colors.text },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  price: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 16,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  saveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  saveBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.success,
    flex: 1,
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerInitial: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  sellerInfo: { flex: 1 },
  sellerLabel: { fontSize: 11, color: colors.textSoft },
  sellerName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginVertical: 2,
  },
  sellerRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  sellerRatingText: { fontSize: 12, color: colors.textSoft },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  messageBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 12, color: colors.textSoft },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  aboutCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  footerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerLabel: { fontSize: 12, color: colors.textSoft },
  footerPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  modalItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  modalPrice: {
    fontSize: 13,
    color: colors.textSoft,
    marginBottom: spacing.lg,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    minWidth: 48,
    textAlign: "center",
  },
  qtyHint: {
    fontSize: 13,
    color: colors.textSoft,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  modalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalTotalLabel: { fontSize: 14, color: colors.textSoft },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  modalAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalAddBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
});
