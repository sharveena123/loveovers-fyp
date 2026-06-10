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
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Clock,
  Gift,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Star,
  X,
  Zap,
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
const IMAGE_HEIGHT = 360;

function getLeftCount(item: AvailableBag) {
  return Math.max(0, item.quantity - (item.sold || 0));
}

export default function MysteryBagDetail() {
  const { id, returnTo } = useLocalSearchParams<{
    id: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.home);
  const [bag, setBag] = useState<AvailableBag | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [contacting, setContacting] = useState(false);

  const loadBagDetails = useCallback(async () => {
    try {
      setLoading(true);
      const preferred = await getPreferredLocation();
      const allBags = await getAvailableBags({
        latitude: preferred?.latitude ?? DEFAULT_LAT,
        longitude: preferred?.longitude ?? DEFAULT_LNG,
      });
      const foundBag = allBags.find((b) => b.id === id);
      if (foundBag) setBag(foundBag);
    } catch (error) {
      console.error("Error loading mystery bag:", error);
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
        type: "bag",
      });

      Alert.alert(
        "Added to cart",
        `${selectedQuantity} mystery bag(s) added successfully.`,
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
      Alert.alert("Error", "Failed to add mystery bag to cart");
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
          <Text style={styles.loadingText}>Loading surprise…</Text>
        </View>
      </View>
    );
  }

  if (!bag) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Gift size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Mystery bag not found</Text>
          <Text style={styles.emptySub}>
            It may have sold out. Check back for new surprises!
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
  const worthUpTo = original;
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
            <LinearGradient
              colors={[colors.primary, "#8B5A2B"]}
              style={styles.heroGradient}
            >
              <Gift size={64} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)"]}
            style={styles.heroFade}
          />

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

          <View style={styles.mysteryBadge}>
            <Sparkles size={14} color={colors.white} />
            <Text style={styles.mysteryBadgeText}>Mystery bag</Text>
          </View>
          {leftCount > 0 && leftCount <= 3 && (
            <View style={styles.urgentPill}>
              <Zap size={12} color={colors.white} />
              <Text style={styles.urgentPillText}>Only {leftCount} left!</Text>
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.sparkleRow}>
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.sparkleText}>Surprise inside</Text>
          </View>
          <Text style={styles.bagName}>{bag.name}</Text>
          {bag.category ? (
            <Text style={styles.tagline}>{bag.category} · curated surprise</Text>
          ) : (
            <Text style={styles.tagline}>Curated surprise from local café</Text>
          )}

          <View style={styles.valueCard}>
            <View style={styles.valueCol}>
              <Text style={styles.valueLabel}>You pay</Text>
              <Text style={styles.valuePay}>RM {price.toFixed(2)}</Text>
            </View>
            <View style={styles.valueDivider} />
            <View style={styles.valueCol}>
              <Text style={styles.valueLabel}>Worth up to</Text>
              <Text style={styles.valueWorth}>RM {worthUpTo.toFixed(2)}</Text>
            </View>
          </View>

          {discount > 0 && (
            <View style={styles.saveBanner}>
              <Leaf size={16} color={colors.success} />
              <Text style={styles.saveBannerText}>
                Save up to {discount}% compared to retail value
              </Text>
            </View>
          )}

          <View style={styles.whatsInside}>
            <Gift size={20} color={colors.primary} />
            <View style={styles.whatsInsideText}>
              <Text style={styles.whatsInsideTitle}>What&apos;s inside?</Text>
              <Text style={styles.whatsInsideDesc}>
                A surprise selection from {bag.sellerName}. Contents vary each
                time — that&apos;s part of the fun!
              </Text>
              {bag.description ? (
                <Text style={styles.whatsInsideExtra}>{bag.description}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Clock size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Expires</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {bag.expiryDate}
              </Text>
            </View>
            <View style={styles.statCard}>
              <MapPin size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{bag.distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.statCard}>
              <Star size={18} color="#FFC107" fill="#FFC107" />
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statValue}>{bag.rating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitial}>
                {bag.sellerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>From</Text>
              <Text style={styles.sellerName}>{bag.sellerName}</Text>
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

          <Text style={styles.sectionTitle}>Why mystery bags?</Text>
          <View style={styles.benefitsCard}>
            {[
              "Rescue surplus food before it goes to waste",
              "Save up to 70% compared to regular prices",
              "Every bag is a unique surprise",
              "Support local cafés and bakeries",
            ].map((line) => (
              <View key={line} style={styles.benefitRow}>
                <View style={styles.benefitDot} />
                <Text style={styles.benefitText}>{line}</Text>
              </View>
            ))}
          </View>

          {!soldOut && (
            <View style={styles.urgencyCard}>
              <Zap size={18} color="#E67E22" />
              <View style={styles.urgencyText}>
                <Text style={styles.urgencyTitle}>
                  {leftCount} bag{leftCount > 1 ? "s" : ""} remaining
                </Text>
                <Text style={styles.urgencySub}>Grab yours before they&apos;re gone</Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <SafeAreaView style={styles.footer}>
        <View style={styles.footerInner}>
          <View>
            <Text style={styles.footerLabel}>From</Text>
            <Text style={styles.footerPrice}>RM {price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.grabBtn, soldOut && styles.grabBtnDisabled]}
            disabled={soldOut || addingToCart}
            onPress={() => setShowQuantityModal(true)}
            activeOpacity={0.9}
          >
            <Gift size={20} color={colors.white} />
            <Text style={styles.grabBtnText}>
              {soldOut ? "Sold out" : "Grab mystery bag"}
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
              <Text style={styles.modalTitle}>How many bags?</Text>
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
            <Text style={styles.qtyHint}>{leftCount} bags available</Text>

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
  heroGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
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
  mysteryBadge: {
    position: "absolute",
    bottom: 36,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 2,
  },
  mysteryBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.white,
  },
  urgentPill: {
    position: "absolute",
    bottom: 36,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E53935",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  urgentPillText: {
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
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  sparkleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bagName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 32,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSoft,
    marginBottom: spacing.lg,
  },
  valueCard: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  valueCol: { flex: 1, alignItems: "center" },
  valueLabel: { fontSize: 12, color: colors.textSoft, marginBottom: 4 },
  valuePay: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  valueWorth: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.success,
  },
  valueDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
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
  whatsInside: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whatsInsideText: { flex: 1 },
  whatsInsideTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  whatsInsideDesc: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  whatsInsideExtra: {
    fontSize: 13,
    color: colors.textSoft,
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statLabel: { fontSize: 11, color: colors.textSoft },
  statValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
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
    marginTop: 2,
  },
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
  benefitsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  benefitText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  urgencyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#FFF8E1",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  urgencyText: { flex: 1 },
  urgencyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E67E22",
  },
  urgencySub: { fontSize: 12, color: "#F57C00", marginTop: 2 },
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
  grabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 14,
  },
  grabBtnDisabled: { opacity: 0.5 },
  grabBtnText: {
    fontSize: 15,
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
