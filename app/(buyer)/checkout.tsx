import { Text } from "@/src/components/StyledText";
import { useAuth } from "@/src/hooks/useAuth";
import {
  CartItem,
  getUserCart,
  removeFromCart,
} from "@/src/services/firebase/cartServices";
import { createConversation } from "@/src/services/firebase/messagingServices";
import { createOrderFromCart } from "@/src/services/firebase/orders";
import {
  BuyerProfile,
  getUserProfile,
} from "@/src/services/firebase/user";
import { colors, spacing } from "@/src/theme/styles";
import { CardField } from "@stripe/stripe-react-native";
import { BUYER_ROUTES, goBackToReturn, pushWithReturn } from "@/src/utils/navigation";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Leaf,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Shield,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type CheckoutStep = "review" | "pickup" | "payment" | "confirmation";

interface PickupForm {
  fullName: string;
  email: string;
  phone: string;
  pickupLocation: string;
  pickupTime: string;
}

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "review", label: "Review" },
  { key: "pickup", label: "Pickup" },
  { key: "payment", label: "Payment" },
];

const PICKUP_TIMES = [
  "10:00 AM",
  "12:00 PM",
  "2:00 PM",
  "4:00 PM",
  "6:00 PM",
];

function stepIndex(step: CheckoutStep) {
  if (step === "review") return 0;
  if (step === "pickup") return 1;
  if (step === "payment") return 2;
  return 3;
}

export default function Checkout() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user, loading: authLoading } = useAuth();

  const exitCheckout = () =>
    goBackToReturn(router, returnTo, BUYER_ROUTES.cart);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] =
    useState<CheckoutStep>("review");
  const [orderNumber, setOrderNumber] = useState("");

  const [pickupForm, setPickupForm] = useState<PickupForm>({
    fullName: "",
    email: "",
    phone: "",
    pickupLocation: "",
    pickupTime: "",
  });

  const pickupLocations = useMemo(
    () =>
      Array.from(
        new Set(cartItems.map((i) => i.sellerName).filter(Boolean)),
      ) as string[],
    [cartItems],
  );

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
      if (user) loadCart();
    }, [user, loadCart]),
  );

  useEffect(() => {
    if (!user) return;

    const prefill = async () => {
      setPickupForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        fullName: user.displayName || prev.fullName,
      }));

      try {
        const profile = await getUserProfile(user.uid);
        if (profile && profile.role === "buyer") {
          const buyer = profile as BuyerProfile;
          setPickupForm((prev) => ({
            ...prev,
            fullName: buyer.fullName || prev.fullName,
            email: buyer.email || prev.email,
            phone: buyer.phone || prev.phone,
          }));
        }
      } catch {
        /* profile optional */
      }
    };

    prefill();
  }, [user]);

  useEffect(() => {
    if (
      pickupLocations.length === 1 &&
      !pickupForm.pickupLocation
    ) {
      setPickupForm((prev) => ({
        ...prev,
        pickupLocation: pickupLocations[0],
      }));
    }
  }, [pickupLocations, pickupForm.pickupLocation]);

  const calculateSubtotal = () =>
    cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const calculateDiscount = () =>
    cartItems.reduce((sum, item) => {
      const original = item.originalPrice || item.price;
      return sum + (original - item.price) * item.quantity;
    }, 0);

  const handlePickupChange = (field: keyof PickupForm, value: string) => {
    setPickupForm((prev) => ({ ...prev, [field]: value }));
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
      Alert.alert("Required", "Please select a pickup café");
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
      const discount = calculateDiscount();
      const generatedOrderNo = `ORD-${Date.now().toString().slice(-8)}`;

      const orderItems = cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        ...(item.imageUrl && { imageUrl: item.imageUrl }),
        ...(item.originalPrice != null && {
          originalPrice: item.originalPrice,
        }),
        ...(item.type && { type: item.type }),
      }));

      await createOrderFromCart(
        user.uid,
        orderItems,
        subtotal,
        total,
        discount,
        {
          fullName: pickupForm.fullName,
          email: pickupForm.email,
          phone: pickupForm.phone,
          street: pickupForm.pickupLocation,
          city: pickupForm.pickupTime,
          state: "Pickup",
          postalCode: "",
        },
        "pi_test",
      );

      for (const item of cartItems) {
        await removeFromCart(user.uid, item.id);
      }

      setOrderNumber(generatedOrderNo);
      setCurrentStep("confirmation");
    } catch (orderError) {
      console.error("Error creating order:", orderError);
      Alert.alert("Error", "Failed to create order. Please contact support.");
    } finally {
      setProcessing(false);
    }
  };

  const goToHome = () => router.push("/(buyer)/buyerhome");

  const goBack = () => {
    if (currentStep === "review") exitCheckout();
    else if (currentStep === "pickup") setCurrentStep("review");
    else if (currentStep === "payment") setCurrentStep("pickup");
    else goToHome();
  };

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = subtotal;
  const activeStep = stepIndex(currentStep);

  const stepTitle =
    currentStep === "review"
      ? "Order review"
      : currentStep === "pickup"
        ? "Pickup details"
        : currentStep === "payment"
          ? "Payment"
          : "Order confirmed";

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing checkout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <CheckoutHeader title="Checkout" onBack={exitCheckout} />
        <View style={styles.centered}>
          <ShoppingBag size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptySub}>
            Sign in to complete your rescue order.
          </Text>
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

  if (cartItems.length === 0 && currentStep !== "confirmation") {
    return (
      <SafeAreaView style={styles.container}>
        <CheckoutHeader title="Checkout" onBack={exitCheckout} />
        <View style={styles.centered}>
          <ShoppingBag size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>
            Add surplus deals before checking out.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goToHome}>
            <Text style={styles.primaryBtnText}>Browse deals</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <CheckoutHeader title={stepTitle} onBack={goBack} />

        {currentStep !== "confirmation" && (
          <StepProgress activeIndex={activeStep} />
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === "review" && (
            <ReviewStep
              cartItems={cartItems}
              subtotal={subtotal}
              discount={discount}
              total={total}
            />
          )}
          {currentStep === "pickup" && (
            <PickupStep
              form={pickupForm}
              onFormChange={handlePickupChange}
              pickupLocations={pickupLocations}
            />
          )}
          {currentStep === "payment" && (
            <PaymentStep
              subtotal={subtotal}
              discount={discount}
              total={total}
              pickupForm={pickupForm}
            />
          )}
          {currentStep === "confirmation" && (
            <ConfirmationStep
              orderNumber={orderNumber}
              pickupForm={pickupForm}
            />
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.footer}>
          {currentStep !== "confirmation" && (
            <View style={styles.footerTotal}>
              <Text style={styles.footerTotalLabel}>Total</Text>
              <Text style={styles.footerTotalValue}>
                RM {total.toFixed(2)}
              </Text>
            </View>
          )}

          {currentStep === "review" && (
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={() => setCurrentStep("pickup")}
              activeOpacity={0.9}
            >
              <Text style={styles.footerBtnText}>Continue to pickup</Text>
              <ChevronRight size={20} color={colors.white} />
            </TouchableOpacity>
          )}

          {currentStep === "pickup" && (
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={handleProceedToPayment}
              activeOpacity={0.9}
            >
              <Text style={styles.footerBtnText}>Continue to payment</Text>
              <ChevronRight size={20} color={colors.white} />
            </TouchableOpacity>
          )}

          {currentStep === "payment" && (
            <TouchableOpacity
              style={[styles.footerBtn, processing && styles.footerBtnDisabled]}
              onPress={handlePayment}
              disabled={processing}
              activeOpacity={0.9}
            >
              <Lock size={18} color={colors.white} />
              <Text style={styles.footerBtnText}>
                {processing ? "Processing…" : `Pay RM ${total.toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep === "confirmation" && (
            <View style={styles.confirmFooter}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push("/(buyer)/buyerorders")}
              >
                <Text style={styles.secondaryBtnText}>View orders</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={goToHome}
                activeOpacity={0.9}
              >
                <Text style={styles.footerBtnText}>Back to home</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CheckoutHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerDecor} />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <View style={styles.greetingRow}>
            <Sparkles size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.greeting}>Secure checkout</Text>
          </View>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

function StepProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.stepBar}>
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={styles.stepTop}>
              <View
                style={[
                  styles.stepCircle,
                  (done || active) && styles.stepCircleActive,
                  done && styles.stepCircleDone,
                ]}
              >
                {done ? (
                  <Check size={14} color={colors.white} strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.stepNum,
                      (done || active) && styles.stepNumActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    index < activeIndex && styles.stepLineDone,
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                (done || active) && styles.stepLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

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

  const grouped = useMemo(() => {
    const map = new Map<string, { seller: string; items: CartItem[] }>();
    for (const item of cartItems) {
      const key = item.sellerId || item.sellerName;
      const existing = map.get(key);
      if (existing) existing.items.push(item);
      else map.set(key, { seller: item.sellerName, items: [item] });
    }
    return Array.from(map.values());
  }, [cartItems]);

  const handleContactSeller = async (seller: {
    id: string;
    name: string;
  }) => {
    if (!user) {
      Alert.alert("Login required", "Please log in first");
      return;
    }

    try {
      let buyerName = user.displayName || "Buyer";
      try {
        const profile = await getUserProfile(user.uid);
        if (profile && (profile as BuyerProfile).fullName) {
          buyerName = (profile as BuyerProfile).fullName;
        }
      } catch {
        /* fallback */
      }

      const conversationId = await createConversation(
        user.uid,
        buyerName,
        seller.id,
        seller.name,
      );
      pushWithReturn(
        router,
        `/(buyer)/chat/${conversationId}`,
        BUYER_ROUTES.home,
      );
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Failed to contact seller");
    }
  };

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
      <Text style={styles.blockTitle}>
        {cartItems.reduce((s, i) => s + i.quantity, 0)} items ·{" "}
        {grouped.length} seller{grouped.length !== 1 ? "s" : ""}
      </Text>

      {grouped.map((group) => (
        <View key={group.seller} style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>{group.seller}</Text>
          </View>
          {group.items.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.orderRow,
                idx < group.items.length - 1 && styles.orderRowBorder,
              ]}
            >
              <View style={styles.orderThumb}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.orderThumbImg}
                  />
                ) : (
                  <ShoppingBag size={22} color={colors.primary} />
                )}
                {item.type === "bag" && (
                  <View style={styles.mysteryDot}>
                    <Text style={styles.mysteryDotText}>?</Text>
                  </View>
                )}
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.orderMeta}>Qty {item.quantity}</Text>
              </View>
              <Text style={styles.orderPrice}>
                RM {(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {uniqueSellers.length > 0 && (
        <View style={styles.contactCard}>
          <MessageCircle size={18} color={colors.primary} />
          <View style={styles.contactCardBody}>
            <Text style={styles.contactTitle}>Questions before pickup?</Text>
            <Text style={styles.contactSub}>
              Message the seller directly about your order.
            </Text>
            {uniqueSellers.map((seller) => (
              <TouchableOpacity
                key={seller.id}
                style={styles.contactChip}
                onPress={() => handleContactSeller(seller)}
              >
                <Text style={styles.contactChipText}>Chat · {seller.name}</Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <SummaryCard
        subtotal={subtotal}
        discount={discount}
        total={total}
        title="Order summary"
      />
    </View>
  );
}

function PickupStep({
  form,
  onFormChange,
  pickupLocations,
}: {
  form: PickupForm;
  onFormChange: (field: keyof PickupForm, value: string) => void;
  pickupLocations: string[];
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.infoBanner}>
        <MapPin size={18} color={colors.primary} />
        <Text style={styles.infoBannerText}>
          Pick up your rescued food in person at the selected café. No delivery
          for surplus orders.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <User size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Your details</Text>
        </View>

        <FormField
          label="Full name"
          icon={<User size={16} color={colors.textSoft} />}
          placeholder="Your full name"
          value={form.fullName}
          onChangeText={(t) => onFormChange("fullName", t)}
        />
        <FormField
          label="Email"
          icon={<Mail size={16} color={colors.textSoft} />}
          placeholder="you@email.com"
          value={form.email}
          onChangeText={(t) => onFormChange("email", t)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          label="Phone"
          icon={<Phone size={16} color={colors.textSoft} />}
          placeholder="+60 12 345 6789"
          value={form.phone}
          onChangeText={(t) => onFormChange("phone", t)}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MapPin size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Pickup café</Text>
        </View>

        {pickupLocations.length === 0 ? (
          <FormField
            label="Location"
            icon={<MapPin size={16} color={colors.textSoft} />}
            placeholder="Enter café name or address"
            value={form.pickupLocation}
            onChangeText={(t) => onFormChange("pickupLocation", t)}
          />
        ) : (
          <View style={styles.chipGrid}>
            {pickupLocations.map((location) => {
              const selected = form.pickupLocation === location;
              return (
                <TouchableOpacity
                  key={location}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => onFormChange("pickupLocation", location)}
                >
                  <MapPin
                    size={14}
                    color={selected ? colors.white : colors.primary}
                  />
                  <Text
                    style={[styles.chipText, selected && styles.chipTextActive]}
                    numberOfLines={2}
                  >
                    {location}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Pickup time</Text>
        </View>
        <View style={styles.timeGrid}>
          {PICKUP_TIMES.map((time) => {
            const selected = form.pickupTime === time;
            return (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, selected && styles.timeChipActive]}
                onPress={() => onFormChange("pickupTime", time)}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    selected && styles.timeChipTextActive,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function PaymentStep({
  subtotal,
  discount,
  total,
  pickupForm,
}: {
  subtotal: number;
  discount: number;
  total: number;
  pickupForm: PickupForm;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.pickupRecap}>
        <MapPin size={16} color={colors.primary} />
        <View style={styles.pickupRecapText}>
          <Text style={styles.pickupRecapTitle}>Pickup</Text>
          <Text style={styles.pickupRecapValue} numberOfLines={1}>
            {pickupForm.pickupLocation || "—"} · {pickupForm.pickupTime || "—"}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <CreditCard size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Card details</Text>
        </View>
        <View style={styles.secureRow}>
          <Shield size={14} color={colors.success} />
          <Text style={styles.secureText}>
            Secured by Stripe · encrypted end-to-end
          </Text>
        </View>
        <CardField
          postalCodeEnabled={false}
          style={styles.cardField}
          cardStyle={{
            backgroundColor: colors.background,
            textColor: colors.text,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }}
        />
      </View>

      <SummaryCard
        subtotal={subtotal}
        discount={discount}
        total={total}
        title="Payment summary"
      />
    </View>
  );
}

function ConfirmationStep({
  orderNumber,
  pickupForm,
}: {
  orderNumber: string;
  pickupForm: PickupForm;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.successCard}>
        <View style={styles.successIcon}>
          <CheckCircle2 size={48} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Order confirmed!</Text>
        <Text style={styles.successSub}>
          Thank you for rescuing surplus food. Show your order at pickup.
        </Text>

        <View style={styles.orderNoBox}>
          <Text style={styles.orderNoLabel}>Order number</Text>
          <Text style={styles.orderNoValue}>
            #{orderNumber || `ORD-${Date.now().toString().slice(-8)}`}
          </Text>
        </View>

        <View style={styles.confirmDetails}>
          <View style={styles.confirmRow}>
            <MapPin size={16} color={colors.primary} />
            <View>
              <Text style={styles.confirmLabel}>Pickup at</Text>
              <Text style={styles.confirmValue}>
                {pickupForm.pickupLocation}
              </Text>
            </View>
          </View>
          <View style={styles.confirmDivider} />
          <View style={styles.confirmRow}>
            <Clock size={16} color={colors.primary} />
            <View>
              <Text style={styles.confirmLabel}>Time</Text>
              <Text style={styles.confirmValue}>{pickupForm.pickupTime}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.confirmHint}>
          A confirmation has been sent to {pickupForm.email || "your email"}.
        </Text>
      </View>
    </View>
  );
}

function SummaryCard({
  subtotal,
  discount,
  total,
  title,
}: {
  subtotal: number;
  discount: number;
  total: number;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
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
        <Text style={styles.totalValue}>RM {total.toFixed(2)}</Text>
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
  );
}

function FormField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize,
}: {
  label: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInput}>
        {icon}
        <TextInput
          style={styles.fieldText}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={colors.textSoft}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
  stepBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { flex: 1, alignItems: "center" },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stepCircleActive: { backgroundColor: colors.primary },
  stepCircleDone: { backgroundColor: colors.success },
  stepNum: { fontSize: 12, fontWeight: "800", color: colors.textSoft },
  stepNumActive: { color: colors.white },
  stepLine: {
    position: "absolute",
    left: "55%",
    right: "-45%",
    height: 2,
    backgroundColor: colors.border,
    top: 13,
  },
  stepLineDone: { backgroundColor: colors.success },
  stepLabel: { fontSize: 11, color: colors.textSoft, fontWeight: "600" },
  stepLabelActive: { color: colors.primary, fontWeight: "800" },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepContent: { gap: spacing.md },
  blockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSoft,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  orderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  orderThumbImg: { width: "100%", height: "100%" },
  mysteryDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  mysteryDotText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.white,
  },
  orderInfo: { flex: 1 },
  orderName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  orderMeta: { fontSize: 12, color: colors.textSoft },
  orderPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  contactCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(106,60,0,0.15)",
  },
  contactCardBody: { flex: 1, gap: spacing.sm },
  contactTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  contactSub: { fontSize: 12, color: colors.textSoft, lineHeight: 18 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: 4,
  },
  contactChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  infoBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  fieldGroup: { marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSoft,
    marginBottom: 6,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  chipGrid: { gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  chipTextActive: { color: colors.white, fontWeight: "800" },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: "30%",
    alignItems: "center",
  },
  timeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  timeChipTextActive: { color: colors.white, fontWeight: "800" },
  pickupRecap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickupRecapText: { flex: 1 },
  pickupRecapTitle: { fontSize: 11, color: colors.textSoft },
  pickupRecapValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  secureText: { fontSize: 12, color: colors.success, fontWeight: "600" },
  cardField: {
    height: 52,
    marginVertical: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
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
    marginVertical: spacing.sm,
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
    marginTop: spacing.sm,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.success,
    flex: 1,
  },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  orderNoBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: spacing.md,
    width: "100%",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  orderNoLabel: { fontSize: 12, color: colors.textSoft },
  orderNoValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 4,
  },
  confirmDetails: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  confirmLabel: { fontSize: 11, color: colors.textSoft },
  confirmValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  confirmHint: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 18,
  },
  footer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  footerTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  footerTotalLabel: { fontSize: 13, color: colors.textSoft },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  footerBtnDisabled: { opacity: 0.6 },
  footerBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  confirmFooter: { gap: spacing.sm },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
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
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
  },
});
