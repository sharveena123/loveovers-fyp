import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  CartItem,
  getUserCart,
  removeFromCart,
} from "@/src/services/firebase/cartServices";
import { createConversation } from "@/src/services/firebase/messagingServices";
import { createOrderFromCart } from "@/src/services/firebase/orders";
import { colors, spacing } from "@/src/theme/styles";
import { CardField } from "@stripe/stripe-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Lock, MapPin, Package } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// Uncomment useStripe hook when backend is ready
// import { useStripe } from "@stripe/stripe-react-native";

interface PickupForm {
  fullName: string;
  email: string;
  phone: string;
  pickupLocation: string;
  pickupTime: string;
}

export default function Checkout() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<
    "review" | "pickup" | "payment" | "confirmation"
  >("review");

  const [pickupForm, setPickupForm] = useState<PickupForm>({
    fullName: "",
    email: "",
    phone: "",
    pickupLocation: "",
    pickupTime: "",
  });

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

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadCart();
      }
    }, [user, loadCart]),
  );

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateDiscount = () => {
    return cartItems.reduce((sum, item) => {
      const original = item.originalPrice || item.price;
      return sum + (original - item.price) * item.quantity;
    }, 0);
  };

  const handlePickupChange = (field: keyof PickupForm, value: string) => {
    setPickupForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validatePickupForm = (): boolean => {
    if (!pickupForm.fullName.trim()) {
      Alert.alert("Required", "Please enter your full name");
      return false;
    }
    if (!pickupForm.email.trim()) {
      Alert.alert("Required", "Please enter your email");
      return false;
    }
    if (!pickupForm.phone.trim()) {
      Alert.alert("Required", "Please enter your phone number");
      return false;
    }
    if (!pickupForm.pickupLocation.trim()) {
      Alert.alert("Required", "Please select a pickup cafe");
      return false;
    }
    if (!pickupForm.pickupTime.trim()) {
      Alert.alert("Required", "Please select a pickup time");
      return false;
    }
    return true;
  };

  const handleProceedToPayment = () => {
    if (validatePickupForm()) {
      Keyboard.dismiss();
      setCurrentStep("payment");
    }
  };

  const handlePayment = async () => {
    if (!user) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      setProcessing(true);

      const subtotal = calculateSubtotal();
      const total = subtotal;

      // In a real implementation, you would:
      // 1. Call your backend to create a PaymentIntent
      // 2. Get the clientSecret from the response
      // 3. Initialize payment sheet with the clientSecret

      // For now, we'll show a simplified version
      // Replace with actual backend call when ready

      // Example of how to call your backend:
      // const response = await fetch('YOUR_BACKEND_URL/create-payment-intent', {
      //   method: 'POST',
      //   body: JSON.stringify({ amount: total, userId: user.uid })
      // });
      // const { clientSecret } = await response.json();

      // For testing, we'll proceed without Stripe payment sheet
      // In production, uncomment the payment sheet code below:

      /*
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "LoveOvers",
        customerId: user.uid,
        defaultBillingDetails: {
          name: shippingForm.fullName,
          email: shippingForm.email,
          phone: shippingForm.phone,
          address: {
            city: shippingForm.city,
            country: "MY",
            line1: shippingForm.street,
            postalCode: shippingForm.postalCode,
            state: shippingForm.state,
          },
        },
        paymentIntentClientSecret: clientSecret, // From your backend
      });

      if (initError) {
        Alert.alert("Error", initError.message);
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== "Canceled") {
          Alert.alert("Payment Error", paymentError.message);
        }
        return;
      }
      */

      // Payment successful - create order
      try {
        const orderItems = cartItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          ...(item.imageUrl && { imageUrl: item.imageUrl }),
        }));

        await createOrderFromCart(
          user.uid,
          orderItems,
          subtotal,
          total,
          calculateDiscount(),
          {
            fullName: pickupForm.fullName,
            email: pickupForm.email,
            phone: pickupForm.phone,
            street: pickupForm.pickupLocation,
            city: pickupForm.pickupTime,
            state: "Pickup",
            postalCode: "",
          },
          "pi_test", // Replace with actual payment intent ID after backend setup
        );

        // Clear cart
        for (const item of cartItems) {
          await removeFromCart(user.uid, item.id);
        }

        setCurrentStep("confirmation");
      } catch (orderError) {
        console.error("Error creating order:", orderError);
        Alert.alert("Error", "Failed to create order. Please contact support.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const goToHome = () => {
    router.push("/(buyer)/buyerhome");
  };

  const goBack = () => {
    if (currentStep === "review") {
      router.back();
    } else if (currentStep === "pickup") {
      setCurrentStep("review");
    } else if (currentStep === "payment") {
      setCurrentStep("pickup");
    } else if (currentStep === "confirmation") {
      goToHome();
    }
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
          <Text style={styles.headerTitle}>Checkout</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>You need to log in to checkout</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0 && currentStep !== "confirmation") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Checkout</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Add items to proceed with checkout
          </Text>
          <TouchableOpacity style={styles.button} onPress={goToHome}>
            <Text style={styles.buttonText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.container} enabled>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentStep === "review" && "Order Review"}
            {currentStep === "pickup" && "Pickup Details"}
            {currentStep === "payment" && "Payment Method"}
            {currentStep === "confirmation" && "Order Confirmed"}
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Step Indicator */}
        {currentStep !== "confirmation" && (
          <View style={styles.stepIndicator}>
            <StepDot
              active={
                currentStep === "review" ||
                ["pickup", "payment", "confirmation"].includes(currentStep)
              }
              label="Review"
            />
            <StepDot
              active={["pickup", "payment", "confirmation"].includes(
                currentStep,
              )}
              label="Pickup"
            />
            <StepDot
              active={["payment", "confirmation"].includes(currentStep)}
              label="Payment"
            />
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
          {/* Review Step */}
          {currentStep === "review" && (
            <ReviewStep
              cartItems={cartItems}
              subtotal={subtotal}
              discount={discount}
              total={total}
            />
          )}

          {/* Pickup Step */}
          {currentStep === "pickup" && (
            <PickupStep form={pickupForm} onFormChange={handlePickupChange} />
          )}

          {/* Payment Step */}
          {currentStep === "payment" && (
            <PaymentStep
              subtotal={subtotal}
              discount={discount}
              total={total}
            />
          )}

          {/* Confirmation Step */}
          {currentStep === "confirmation" && <ConfirmationStep />}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          {currentStep === "review" && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setCurrentStep("pickup")}
            >
              <Text style={styles.actionButtonText}>Continue to Pickup</Text>
            </TouchableOpacity>
          )}

          {currentStep === "pickup" && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleProceedToPayment}
            >
              <Text style={styles.actionButtonText}>Continue to Payment</Text>
            </TouchableOpacity>
          )}

          {currentStep === "payment" && (
            <TouchableOpacity
              style={[styles.actionButton, processing && styles.buttonDisabled]}
              onPress={handlePayment}
              disabled={processing}
            >
              <Lock size={18} color={colors.white} style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>
                {processing ? "Processing..." : "Complete Payment"}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep === "confirmation" && (
            <TouchableOpacity style={styles.actionButton} onPress={goToHome}>
              <Text style={styles.actionButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Step Indicator Component
function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={styles.stepDotContainer}>
      <View style={[styles.stepDot, active && styles.stepDotActive]} />
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

// Review Step Component
function ReviewStep({
  cartItems,
  subtotal,
  discount,
  total,
}: {
  cartItems: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const handleContactSeller = async (seller: { id: string; name: string }) => {
    if (!user) {
      Alert.alert("Error", "Please log in first");
      return;
    }

    try {
      const conversationId = await createConversation(
        user.uid,
        user.displayName || "Buyer",
        seller.id,
        seller.name,
      );
      router.push({
        pathname: "/(buyer)/chat/[id]",
        params: { id: conversationId },
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Failed to contact seller");
    }
  };

  // Get unique sellers
  const uniqueSellers = Array.from(
    new Map(
      cartItems.map((item) => [
        item.sellerId,
        { id: item.sellerId, name: item.sellerName },
      ]),
    ).values(),
  );

  return (
    <View style={styles.stepContent}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Package size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Order Items</Text>
        </View>

        {cartItems.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.orderItemInfo}>
              <Text style={styles.orderItemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.orderItemSeller}>{item.sellerName}</Text>
              <Text style={styles.orderItemQuantity}>Qty: {item.quantity}</Text>
            </View>
            <View style={styles.orderItemPrice}>
              <Text style={styles.orderItemPriceText}>
                RM {(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}

        {uniqueSellers.length > 0 && (
          <View style={styles.contactSellerContainer}>
            <Text style={styles.contactSellerLabel}>Have questions?</Text>
            {uniqueSellers.map((seller) => (
              <TouchableOpacity
                key={seller.id}
                style={styles.contactSellerButton}
                onPress={() => handleContactSeller(seller)}
              >
                <Text style={styles.contactSellerButtonText}>
                  Contact {seller.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Order Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>RM {subtotal.toFixed(2)}</Text>
        </View>

        {discount > 0 && (
          <View style={[styles.summaryRow, styles.discountRow]}>
            <Text style={styles.discountLabel}>Discount</Text>
            <Text style={styles.discountValue}>-RM {discount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>RM {total.toFixed(2)}</Text>
        </View>

        {discount > 0 && (
          <Text style={styles.savingsText}>
            💚 You&apos;re saving RM {discount.toFixed(2)}!
          </Text>
        )}
      </View>
    </View>
  );
}

// Pickup Step Component
function PickupStep({
  form,
  onFormChange,
}: {
  form: PickupForm;
  onFormChange: (field: keyof PickupForm, value: string) => void;
}) {
  const pickupLocations = [
    "Loma Haus Bakery - BGC",
    "Loma Haus Bakery - Makati",
    "Loma Haus Bakery - Ortigas",
  ];
  const pickupTimes = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM"];

  return (
    <View style={styles.stepContent}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MapPin size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Pickup Details</Text>
        </View>

        <ShippingInput
          label="Full Name"
          placeholder="John Doe"
          value={form.fullName}
          onChangeText={(text) => onFormChange("fullName", text)}
        />

        <ShippingInput
          label="Email"
          placeholder="john@example.com"
          value={form.email}
          onChangeText={(text) => onFormChange("email", text)}
          keyboardType="email-address"
        />

        <ShippingInput
          label="Phone Number"
          placeholder="+60 12345 6789"
          value={form.phone}
          onChangeText={(text) => onFormChange("phone", text)}
          keyboardType="phone-pad"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pickup Location</Text>
          <View style={styles.input}>
            <TextInput
              style={styles.inputField}
              placeholder="Select a cafe location"
              value={form.pickupLocation}
              onChangeText={(text) => onFormChange("pickupLocation", text)}
              placeholderTextColor={colors.textSoft}
            />
          </View>
          <View style={styles.optionsContainer}>
            {pickupLocations.map((location) => (
              <TouchableOpacity
                key={location}
                style={[
                  styles.optionButton,
                  form.pickupLocation === location && styles.optionButtonActive,
                ]}
                onPress={() => onFormChange("pickupLocation", location)}
              >
                <Text
                  style={[
                    styles.optionText,
                    form.pickupLocation === location && styles.optionTextActive,
                  ]}
                >
                  {location}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pickup Time</Text>
          <View style={styles.optionsContainer}>
            {pickupTimes.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeButton,
                  form.pickupTime === time && styles.timeButtonActive,
                ]}
                onPress={() => onFormChange("pickupTime", time)}
              >
                <Text
                  style={[
                    styles.timeButtonText,
                    form.pickupTime === time && styles.timeButtonTextActive,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// Shipping Input Component
function ShippingInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.input}>
        <TextInput
          style={styles.inputField}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType as any}
          placeholderTextColor={colors.textSoft}
        />
      </View>
    </View>
  );
}

// Payment Step Component
function PaymentStep({
  subtotal,
  discount,
  total,
}: {
  subtotal: number;
  discount: number;
  total: number;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Lock size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Payment Method</Text>
        </View>

        <Text style={styles.paymentDescription}>
          Enter your card details below. Your payment is secure and encrypted.
        </Text>

        <CardField postalCodeEnabled={false} style={styles.cardField} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Payment Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>RM {subtotal.toFixed(2)}</Text>
        </View>

        {discount > 0 && (
          <View style={[styles.summaryRow, styles.discountRow]}>
            <Text style={styles.discountLabel}>Discount</Text>
            <Text style={styles.discountValue}>-RM {discount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalPrice}>RM {total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// Confirmation Step Component
function ConfirmationStep() {
  return (
    <View style={styles.stepContent}>
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationCheckmark}>
          <Text style={styles.confirmationCheckmarkText}>✓</Text>
        </View>
        <Text style={styles.confirmationTitle}>Order Confirmed!</Text>
        <Text style={styles.confirmationText}>
          Thank you for your purchase. Your order has been successfully placed.
        </Text>
        <Text style={styles.confirmationText}>
          You will receive an email confirmation shortly with your order details
          and tracking information.
        </Text>
        <View style={styles.confirmationInfo}>
          <Text style={styles.confirmationLabel}>Order Number:</Text>
          <Text style={styles.confirmationValue}>#ORD-{Date.now()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepDotContainer: {
    alignItems: "center",
    gap: spacing.sm,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  stepContent: {
    gap: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderItemInfo: {
    flex: 1,
    gap: 4,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  orderItemSeller: {
    fontSize: 12,
    color: colors.textSoft,
  },
  orderItemQuantity: {
    fontSize: 12,
    color: colors.textSoft,
  },
  orderItemPrice: {
    marginLeft: spacing.md,
  },
  orderItemPriceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSoft,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  discountRow: {
    paddingVertical: spacing.md,
  },
  discountLabel: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  discountValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
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
    paddingVertical: spacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  savingsText: {
    fontSize: 13,
    color: colors.primary,
    marginTop: spacing.md,
    fontWeight: "600",
  },
  inputGroup: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  inputField: {
    height: 44,
    fontSize: 14,
    color: colors.text,
  },
  rowInputs: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 18,
  },
  cardField: {
    height: 50,
    marginVertical: spacing.md,
  },
  confirmationCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.lg,
  },
  confirmationCheckmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmationCheckmarkText: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.primary,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  confirmationText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmationInfo: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: spacing.md,
    width: "100%",
    gap: spacing.sm,
  },
  confirmationLabel: {
    fontSize: 12,
    color: colors.textSoft,
  },
  confirmationValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
    textAlign: "center",
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  timeButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  timeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timeButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
    textAlign: "center",
  },
  timeButtonTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  contactSellerContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  contactSellerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
    marginBottom: spacing.sm,
  },
  contactSellerButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  contactSellerButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
  },
});
