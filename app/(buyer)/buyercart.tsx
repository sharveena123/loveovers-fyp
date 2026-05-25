import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  CartItem,
  getUserCart,
  removeFromCart,
  updateCartItemQuantity,
} from "@/src/services/firebase/cartServices";
import { colors, spacing } from "@/src/theme/styles";
import { BUYER_ROUTES, goBackToReturn, pushWithReturn } from "@/src/utils/navigation";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Leaf,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

function CartItemCard({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  const isMystery = item.type === "bag";

  return (
    <View style={styles.cartCard}>
      <View style={styles.itemImageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <ShoppingBag size={28} color={colors.primary} />
          </View>
        )}
        {isMystery && (
          <View style={styles.mysteryTag}>
            <Text style={styles.mysteryTagText}>Mystery</Text>
          </View>
        )}
      </View>

      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <View style={styles.itemTitles}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.itemSeller}>{item.sellerName}</Text>
          </View>
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.itemPrice}>RM {item.price.toFixed(2)}</Text>
          {item.originalPrice && item.originalPrice > item.price && (
            <Text style={styles.originalPrice}>
              RM {item.originalPrice.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.qtyControl}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onUpdateQty(item.quantity - 1)}
            >
              <Minus size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onUpdateQty(item.quantity + 1)}
            >
              <Plus size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.lineTotal}>
            RM {(item.price * item.quantity).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function BuyerCart() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();

  const handleBack = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.home);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    try {
      const items = await getUserCart(user.uid);
      setCartItems(items);
    } catch (error) {
      console.error("Error loading cart:", error);
      Alert.alert("Error", "Failed to load cart items");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        setLoading(true);
        loadCart().finally(() => setLoading(false));
      }
    }, [user, authLoading, loadCart]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  }, [loadCart]);

  const updateQuantity = async (id: string, newQuantity: number) => {
    if (!user) return;

    try {
      if (newQuantity <= 0) {
        await removeFromCart(user.uid, id);
        setCartItems((prev) => prev.filter((i) => i.id !== id));
        return;
      }
      await updateCartItemQuantity(user.uid, id, newQuantity);
      setCartItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity: newQuantity } : i)),
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity");
      loadCart();
    }
  };

  const removeItem = async (id: string) => {
    if (!user) return;
    try {
      await removeFromCart(user.uid, id);
      setCartItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Error removing item:", error);
      Alert.alert("Error", "Failed to remove item");
      loadCart();
    }
  };

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = cartItems.reduce((s, i) => {
    const orig = i.originalPrice || i.price;
    return s + Math.max(0, orig - i.price) * i.quantity;
  }, 0);

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading cart…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your cart</Text>
        </View>
        <View style={styles.centered}>
          <ShoppingCart size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Please log in</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.primaryBtnText}>Go to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your cart</Text>
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <ShoppingCart size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>
            Rescue surplus food from nearby cafés and bakeries.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(buyer)/buyerhome")}
          >
            <Text style={styles.primaryBtnText}>Browse deals</Text>
            <ChevronRight size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <View style={styles.greetingRow}>
              <Sparkles size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greeting}>Checkout</Text>
            </View>
            <Text style={styles.headerTitle}>Your cart</Text>
            <Text style={styles.headerSub}>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {cartItems.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onRemove={() => removeItem(item.id)}
            onUpdateQty={(qty) => updateQuantity(item.id, qty)}
          />
        ))}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>RM {subtotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>
                You save
              </Text>
              <Text style={styles.discountValue}>-RM {discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>RM {subtotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.savingsBanner}>
              <Leaf size={16} color={colors.success} />
              <Text style={styles.savingsText}>
                Saving RM {discount.toFixed(2)} on this order
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.checkoutBarLabel}>Total</Text>
          <Text style={styles.checkoutBarTotal}>RM {subtotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() =>
            pushWithReturn(router, "/(buyer)/checkout", BUYER_ROUTES.cart)
          }
          activeOpacity={0.9}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
          <ChevronRight size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerDecor: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40,
    right: -20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    zIndex: 1,
  },
  headerTextWrap: { flex: 1 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  greeting: { fontSize: 12, color: "rgba(255,255,255,0.9)" },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.white,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cartCard: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: spacing.md,
  },
  itemImageWrap: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    position: "relative",
  },
  itemImage: { width: "100%", height: "100%" },
  itemImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mysteryTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mysteryTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.white,
  },
  itemBody: { flex: 1 },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  itemTitles: { flex: 1 },
  itemName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  itemSeller: { fontSize: 12, color: colors.textSoft },
  removeBtn: { padding: 4 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  itemPrice: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    minWidth: 28,
    textAlign: "center",
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  summaryLabel: { fontSize: 14, color: colors.textSoft },
  summaryValue: { fontSize: 14, fontWeight: "700", color: colors.text },
  discountValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalLabel: { fontSize: 16, fontWeight: "800", color: colors.text },
  totalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  savingsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.sm,
    borderRadius: 10,
    marginTop: spacing.md,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.success,
    flex: 1,
  },
  checkoutBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  checkoutBarLabel: { fontSize: 12, color: colors.textSoft },
  checkoutBarTotal: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 14,
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
});
