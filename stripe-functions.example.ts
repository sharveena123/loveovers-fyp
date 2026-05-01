/**
 * Sample Firebase Cloud Function for Stripe Payment Processing
 * Deploy this to Firebase Functions to handle server-side payment operations
 *
 * Setup:
 * 1. Create a Cloud Functions project: firebase init functions
 * 2. Install Stripe: npm install stripe
 * 3. Set your Stripe key: firebase functions:config:set stripe.key="sk_test_..."
 * 4. Deploy: firebase deploy --only functions
 */

import * as functions from "firebase-functions";
import Stripe from "stripe";
import { db } from "./firebase-admin";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

/**
 * Create a Payment Intent for checkout
 * Callable from mobile app with proper authentication
 */
export const createPaymentIntent = functions.https.onCall(
  async (data, context) => {
    // Check user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to create payment intent",
      );
    }

    try {
      const { amount, cartItems, customerId } = data;

      // Validate input
      if (!amount || amount <= 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Amount must be greater than 0",
        );
      }

      // Create the payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents (Stripe uses cents)
        currency: "myr", // Malaysian Ringgit
        customer: customerId || undefined,
        metadata: {
          userId: context.auth.uid,
          itemCount: cartItems?.length || 0,
          timestamp: new Date().toISOString(),
        },
        // Indicate that this payment will complete off-session
        off_session: false,
      });

      // Log payment intent creation
      await db.collection("payment-intents").add({
        paymentIntentId: paymentIntent.id,
        userId: context.auth.uid,
        amount,
        status: paymentIntent.status,
        cartItems,
        createdAt: new Date(),
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
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

/**
 * Confirm a payment and create an order
 */
export const confirmPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    const { paymentIntentId, orderId } = data;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Update order status in Firestore
      await db
        .collection("users")
        .doc(context.auth.uid)
        .collection("orders")
        .doc(orderId)
        .update({
          paymentStatus: "succeeded",
          orderStatus: "confirmed",
          updatedAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        });

      return {
        success: true,
        status: "confirmed",
      };
    } else if (paymentIntent.status === "processing") {
      return {
        success: false,
        status: "processing",
        message: "Payment is still processing",
      };
    } else {
      return {
        success: false,
        status: paymentIntent.status,
        message: "Payment failed",
      };
    }
  } catch (error) {
    console.error("Error confirming payment:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to confirm payment",
    );
  }
});

/**
 * Stripe webhook handler for payment confirmations
 * Set webhook URL in Stripe Dashboard: https://yourfunction.cloudfunctions.net/handleStripeWebhook
 */
export const handleStripeWebhook = functions.https.onRequest(
  async (request, response) => {
    try {
      const sig = request.headers["stripe-signature"];

      if (!sig) {
        response.status(400).send("Missing Stripe signature");
        return;
      }

      // Verify webhook signature
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          request.rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET || "",
        );
      } catch (error) {
        response.status(400).json({ error: "Invalid signature" });
        return;
      }

      // Handle different event types
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object);
          break;
        case "charge.refunded":
          await handleChargeRefunded(event.data.object);
          break;
      }

      response.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      response.status(500).json({ error: "Webhook failed" });
    }
  },
);

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error("No user ID in payment intent metadata");
    return;
  }

  try {
    // Find and update related order
    const ordersSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("paymentIntentId", "==", paymentIntent.id)
      .limit(1)
      .get();

    if (!ordersSnapshot.empty) {
      const orderId = ordersSnapshot.docs[0].id;
      await ordersSnapshot.docs[0].ref.update({
        paymentStatus: "succeeded",
        orderStatus: "processing",
        updatedAt: new Date(),
      });

      console.log(`Order ${orderId} confirmed for user ${userId}`);
    }
  } catch (error) {
    console.error("Error handling payment success:", error);
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error("No user ID in payment intent metadata");
    return;
  }

  try {
    // Find and update related order
    const ordersSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("paymentIntentId", "==", paymentIntent.id)
      .limit(1)
      .get();

    if (!ordersSnapshot.empty) {
      const orderId = ordersSnapshot.docs[0].id;
      await ordersSnapshot.docs[0].ref.update({
        paymentStatus: "failed",
        orderStatus: "cancelled",
        failureReason: paymentIntent.last_payment_error?.message,
        updatedAt: new Date(),
      });

      console.log(`Order ${orderId} payment failed for user ${userId}`);
    }
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}

/**
 * Handle refunded charge
 */
async function handleChargeRefunded(charge: any) {
  const userId = charge.metadata?.userId;

  if (!userId) {
    console.error("No user ID in charge metadata");
    return;
  }

  try {
    // Find and update related order
    const ordersSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("stripePaymentIntentId", "==", charge.payment_intent)
      .limit(1)
      .get();

    if (!ordersSnapshot.empty) {
      const orderId = ordersSnapshot.docs[0].id;
      await ordersSnapshot.docs[0].ref.update({
        paymentStatus: "refunded",
        orderStatus: "cancelled",
        refundedAmount: charge.amount_refunded,
        refundedAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Order ${orderId} refunded for user ${userId}`);
    }
  } catch (error) {
    console.error("Error handling refund:", error);
  }
}
