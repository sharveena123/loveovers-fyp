# Stripe Integration Setup Guide

## Overview

This checkout implementation uses Stripe for payment processing. Follow these steps to complete the setup.

## Prerequisites

- Stripe Account (https://stripe.com)
- Stripe CLI (for local testing)
- Firebase project

## Step 1: Get Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers → API Keys**
3. Copy your **Publishable Key** (starts with `pk_test_`)
4. Copy your **Secret Key** (starts with `sk_test_`)

## Step 2: Update Environment Variables

1. Create a `.env` file in the project root (copy from `.env.example`)
2. Replace the placeholder values with your actual Stripe keys:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

## Step 3: Update App Configuration

Update `app/_layout.tsx` with your publishable key:

```typescript
const STRIPE_PUBLISHABLE_KEY = "YOUR_ACTUAL_KEY";
```

## Step 4: Backend Integration

The complete payment flow requires a backend server to:

1. **Create Payment Intents**: Handle sensitive Stripe operations
2. **Confirm Payments**: Validate payment results
3. **Webhook Handling**: Listen for Stripe events

### Quick Start with Cloud Functions

Create a Firebase Cloud Function:

```typescript
import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export const createPaymentIntent = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authenticated",
      );
    }

    try {
      const { amount, cartItems } = data;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "myr",
        metadata: {
          userId: context.auth.uid,
          itemCount: cartItems.length,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create payment intent",
      );
    }
  },
);
```

## Step 5: Update Checkout Service

Replace `YOUR_BACKEND_URL` in `src/services/firebase/stripeServices.ts` with your actual backend URL:

```typescript
const response = await fetch("https://YOUR_FUNCTION_URL/createPaymentIntent", {
  // ...
});
```

## Step 6: Test Payment

Use Stripe test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- **Expiry**: Any future date
- **CVC**: Any 3-digit number

## Step 7: Webhook Setup (Optional but Recommended)

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login to your Stripe account via CLI
3. Forward webhook events:

```bash
stripe listen --forward-to localhost:3000/webhooks
```

4. Listen for events in your backend:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

## Troubleshooting

### Payment fails with "No payment method attached"

- Ensure CardField is properly initialized
- Check that card details are captured before payment

### "Your Stripe account does not support payments in this country"

- Verify your Stripe account supports MYR (Malaysian Ringgit)
- Check account settings in Stripe Dashboard

### Test Cards Not Working

- Ensure you're using Stripe test keys (starts with `pk_test_`)
- Use proper test card numbers listed above

## Production Checklist

- [ ] Move to Stripe production keys (`pk_live_`)
- [ ] Set up proper error handling and logging
- [ ] Implement webhook verification
- [ ] Add order confirmation emails
- [ ] Test 3DS authentication flow
- [ ] Set up refund processes
- [ ] Enable invoice generation
- [ ] Monitor for suspicious transactions

## Resources

- [Stripe React Native Documentation](https://stripe.dev/stripe-react-native)
- [Stripe Payment Integration Guide](https://stripe.com/docs/payments/payment-intents)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
