import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
    CartItem,
    getUserCart,
    removeFromCart,
    updateCartItemQuantity,
} from "@/src/services/firebase/cartServices";
import { colors, spacing } from "@/src/theme/styles";
import { useFocusEffect, useRouter } from "expo-router";
import { Minus, Plus, ShoppingCart, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

export default function BuyerCart() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load cart from Firestore when user changes or page is focused
  const loadCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const items = await getUserCart(user.uid);
      setCartItems(items);
    } catch (error) {
      console.error("Error loading cart:", error);
      Alert.alert("Error", "Failed to load cart items");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadCart();
    }
  }, [user, authLoading, loadCart]);

  // Reload cart when focusing on page
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadCart();
      }
    }, [user, loadCart]),
  );

  const updateQuantity = async (id: string, newQuantity: number) => {
    if (!user) return;

    try {
      if (newQuantity <= 0) {
        await removeItem(id);
        return;
      }

      await updateCartItemQuantity(user.uid, id, newQuantity);
      // Update local state optimistically
      setCartItems(
        cartItems.map((item) =>
          item.id === id ? { ...item, quantity: newQuantity } : item,
        ),
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update item quantity");
      // Reload cart on error
      loadCart();
    }
  };

  const removeItem = async (id: string) => {
    if (!user) return;

    try {
      await removeFromCart(user.uid, id);
      // Update local state optimistically
      setCartItems(cartItems.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error removing item:", error);
      Alert.alert("Error", "Failed to remove item from cart");
      // Reload cart on error
      loadCart();
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateDiscount = () => {
    return cartItems.reduce((sum, item) => {
      const original = item.originalPrice || item.price;
      return sum + (original - item.price) * item.quantity;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = subtotal;

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <ShoppingCart size={64} color={colors.textSoft} />
          </View>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>
            You need to log in to view your cart
          </Text>
          <TouchableOpacity
            style={styles.browsButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.browseButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <ShoppingCart size={64} color={colors.textSoft} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Start adding delicious deals to your cart!
          </Text>
          <TouchableOpacity
            style={styles.browsButton}
            onPress={() => router.push("/(buyer)/buyerhome")}
          >
            <Text style={styles.browseButtonText}>Browse Items</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <Text style={styles.itemCountText}>
          {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item
          {cartItems.reduce((sum, item) => sum + item.quantity, 0) !== 1
            ? "s"
            : ""}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={styles.content}>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.cartItemCard}>
              {/* Item Image */}
              <View style={styles.itemImageContainer}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.itemImage}
                  />
                ) : (
                  <View style={styles.itemImagePlaceholder}>
                    <Text style={styles.itemImagePlaceholderText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Item Details */}
              <View style={styles.itemDetails}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleSection}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSeller}>{item.sellerName}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    style={styles.removeButton}
                  >
                    <X size={18} color={colors.textSoft} />
                  </TouchableOpacity>
                </View>

                {/* Price Info */}
                <View style={styles.priceRow}>
                  <Text style={styles.itemPrice}>
                    RM {item.price.toFixed(2)}
                  </Text>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <Text style={styles.originalPrice}>
                      RM {item.originalPrice.toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Quantity Controls */}
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Item Total */}
                <View style={styles.itemTotalRow}>
                  <Text style={styles.itemTotalLabel}>Subtotal:</Text>
                  <Text style={styles.itemTotalPrice}>
                    RM {(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Promo Code */}
          <View style={styles.promoSection}>
            <Text style={styles.promoLabel}>Have a promo code?</Text>
            <View style={styles.promoInputRow}>
              <View style={styles.promoInput} />
              <TouchableOpacity style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>RM {subtotal.toFixed(2)}</Text>
            </View>

            {discount > 0 && (
              <View style={[styles.summaryRow, styles.discountRow]}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountValue}>
                  -RM {discount.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>RM {total.toFixed(2)}</Text>
            </View>

            {discount > 0 && (
              <Text style={styles.savingsText}>
                💚 You&apos;re saving RM {discount.toFixed(2)} with this order!
              </Text>
            )}
          </View>

          {/* Checkout Button */}
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => router.push("/(buyer)/checkout")}
          >
            <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
          </TouchableOpacity>

          {/* Continue Shopping */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push("/(buyer)/buyerhome")}
          >
            <Text style={styles.continueButtonText}>Continue Shopping</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  itemCountText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  cartItemCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: spacing.md,
  },
  itemImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  itemImagePlaceholderText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
  },
  itemDetails: {
    flex: 1,
    gap: spacing.sm,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  itemTitleSection: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  itemSeller: {
    fontSize: 12,
    color: colors.textSoft,
  },
  removeButton: {
    padding: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: colors.textSoft,
    textDecorationLine: "line-through",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
  },
  itemTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemTotalLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  itemTotalPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  promoSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  promoInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSoft,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  discountRow: {
    paddingVertical: spacing.md,
  },
  discountLabel: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "600",
  },
  discountValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  savingsText: {
    fontSize: 12,
    color: colors.success,
    marginTop: spacing.md,
    textAlign: "center",
    fontWeight: "500",
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  checkoutButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  continueButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  continueButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  browsButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  browseButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
