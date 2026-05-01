# Checkout Implementation Guide

## Component Overview

The checkout implementation consists of several key components and services:

### 1. **Checkout Page** (`app/(buyer)/checkout.tsx`)

- Multi-step checkout process with Review → Shipping → Payment → Confirmation flow
- Step indicator showing current progress
- Order review with item details and summary
- Shipping address form with validation
- Integrated Stripe card field for payment
- Order confirmation screen

### 2. **Services**

#### Order Services (`src/services/firebase/orders.ts`)

- `createOrderFromCart()` - Creates order from cart items
- `getBuyerOrders()` - Retrieves user's orders
- `updateBuyerOrderStatus()` - Updates order status
- `getOrder()` - Gets single order details

#### Stripe Services (`src/services/firebase/stripeServices.ts`)

- `createPaymentIntent()` - Calls backend to create payment intent
- `saveOrder()` - Saves order to Firebase
- `updateOrderStatus()` - Updates payment/order status
- `getUserOrders()` - Fetches user orders

### 3. **Cart Integration** (`app/(buyer)/buyercart.tsx`)

- Updated checkout button to navigate to checkout page
- Displays cart items with discounts applied
- Shows order summary before checkout

## How It Works

### Step 1: Order Review

- User views all cart items
- Displays subtotal, discount (if any), and total
- Button to proceed to next step

### Step 2: Shipping Address

- Empty form for user to enter shipping details:
  - Full Name
  - Email
  - Phone Number
  - Street Address
  - City, State, Postal Code
- Form validation before proceeding
- Uses TextInput components from React Native

### Step 3: Payment

- Stripe CardField component for secure card entry
- Displays payment summary
- Uses `@stripe/stripe-react-native` for PCI compliance
- Test cards available for testing

### Step 4: Confirmation

- Order confirmation message
- Order number display
- Option to continue shopping

## Setup Checklist

- [ ] Install dependencies: `npm install @stripe/stripe-react-native`
- [ ] Get Stripe keys from https://dashboard.stripe.com
- [ ] Update `app/_layout.tsx` with your Stripe publishable key
- [ ] Set up backend Cloud Functions for payment intent creation
- [ ] Update backend URL in `src/services/firebase/stripeServices.ts`
- [ ] Configure Firebase Firestore collections for orders
- [ ] Test with Stripe test cards
- [ ] Deploy production keys when ready

## File Structure

```
app/
├── (buyer)/
│   ├── checkout.tsx          ← NEW CHECKOUT PAGE
│   ├── buyercart.tsx         ← UPDATED (added navigation)
│   └── ...
├── _layout.tsx               ← UPDATED (added StripeProvider)

src/
├── services/firebase/
│   ├── stripeServices.ts     ← NEW PAYMENT SERVICES
│   ├── orders.ts             ← UPDATED (added order creation)
│   └── ...
└── ...

Root files:
├── STRIPE_SETUP.md           ← SETUP GUIDE
├── CHECKOUT_GUIDE.md         ← THIS FILE
└── stripe-functions.example.ts ← CLOUD FUNCTIONS EXAMPLE
```

## Testing

### Test with Mock Data

```typescript
// Stripe test cards:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
```

### Manual Testing Steps

1. Add items to cart
2. Open cart and click "Proceed to Checkout"
3. Review order items and summary
4. Enter shipping address
5. Enter Stripe test card details
6. Complete payment
7. Confirm order creation in Firebase

## Important Notes

### Security

- Card data is encrypted by Stripe - never sent to your server
- All payment processing validated server-side
- Webhook verification required for security

### Currency

- Currently set to MYR (Malaysian Ringgit)
- Update in Stripe service if needed: `currency: "myr"`

### Testing Limitations

- Stripe test mode doesn't charge cards
- Use test cards only in development
- Switch to live keys for production

### Firebase Structure

Orders are stored at:

```
/users/{userId}/orders/{orderId}
```

With fields:

- `id` - Order ID
- `userId` - User who placed order
- `items` - Array of ordered items
- `subtotal` - Base amount
- `total` - Final amount
- `discount` - Discount applied
- `shippingAddress` - Delivery address
- `paymentIntentId` - Stripe payment ID
- `paymentStatus` - Payment confirmation status
- `orderStatus` - Order fulfillment status
- `createdAt` - Order creation timestamp
- `updatedAt` - Last update timestamp

## Troubleshooting

### Payment fails: "CardField not ready"

- Ensure CardField component is fully rendered
- Check network connection

### Order not saved

- Verify Firebase write permissions
- Check Firestore rules allow user writes

### No payment method attached

- Ensure user filled card details
- Try different test card

### Backend URL error

- Update `stripeServices.ts` with correct backend URL
- Ensure backend is accessible and running
- Check CORS settings if using external API

## Next Steps

1. Deploy Cloud Functions for payment processing
2. Set up webhook for payment confirmations
3. Create order confirmation emails
4. Add refund handling
5. Implement order tracking
6. Add payment failure recovery flow

## References

- [Stripe React Native Docs](https://stripe.dev/stripe-react-native)
- [Stripe Payment Intents API](https://stripe.com/docs/payments/payment-intents)
- [Firebase Firestore Guide](https://firebase.google.com/docs/firestore)
- [React Native Forms Best Practices](https://reactnative.dev/docs/handling-text-input)
