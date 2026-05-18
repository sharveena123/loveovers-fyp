import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./config";

// Push notification flag - determines if notification should be sent as push
export type NotificationDelivery = "in-app" | "push" | "both";

// Get notification delivery method
export const NOTIFICATION_DELIVERY: Record<string, NotificationDelivery> = {
  // SELLER PUSH (high priority - money/ops impact)
  inventory_expiry: "push",
  mystery_bag_selling: "push",
  new_order: "push",
  order_pickup: "push",
  ai_surplus_warning: "push",
  order_canceled: "push",
  customer_message: "push",
  support_issue: "push",

  // SELLER IN-APP (dashboard insights - require thinking)
  low_stock: "in-app",
  items_expired: "in-app",
  high_demand: "in-app",
  no_mystery_bags: "in-app",
  ai_production_reduce: "in-app",
  ai_weekend_spike: "in-app",
  ai_sales_trend: "in-app",
  daily_report: "in-app",
  top_item: "in-app",
  waste_increased: "in-app",

  // BUYER PUSH (customer engagement & urgency)
  order_ready: "push",
  pickup_starts: "push",
  mystery_bag_available: "push",
  price_drop: "push",
  popular_deal_nearby: "push",
  new_bakery_nearby: "push",
  payment_success: "push",
  order_canceled_buyer: "push",

  // BUYER IN-APP (browsing context - non-urgent)
  order_confirmed: "in-app",
  expiring_items_nearby: "in-app",
  limited_offer: "in-app",
  ai_personalized: "in-app",
  ai_weekend_habits: "in-app",
  ai_favorite_bakery: "in-app",
  refund_processed: "in-app",
  seller_replied: "in-app",
  pickup_time_updated: "in-app",
};

export type NotificationType =
  | "inventory_expiry"
  | "low_stock"
  | "items_expired"
  | "new_order"
  | "order_canceled"
  | "order_pickup"
  | "high_demand"
  | "mystery_bag_selling"
  | "no_mystery_bags"
  | "ai_surplus_warning"
  | "ai_production_reduce"
  | "ai_weekend_spike"
  | "ai_sales_trend"
  | "daily_report"
  | "top_item"
  | "waste_increased"
  | "customer_message"
  | "support_issue"
  | "new_bakery_nearby"
  | "popular_deal_nearby"
  | "expiring_items_nearby"
  | "order_confirmed"
  | "pickup_starts"
  | "order_ready"
  | "order_canceled_buyer"
  | "mystery_bag_available"
  | "price_drop"
  | "limited_offer"
  | "ai_personalized"
  | "ai_weekend_habits"
  | "ai_favorite_bakery"
  | "payment_success"
  | "refund_processed"
  | "seller_replied"
  | "pickup_time_updated";

export type UserRole = "seller" | "buyer";

export interface Notification {
  id?: string;
  userId: string;
  userRole: "seller" | "buyer";
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>; // Holds actual data (itemName, quantity, location, etc)
  read: boolean;
  createdAt: Timestamp;
  actionUrl?: string; // Link to related screen
}

// SELLER NOTIFICATIONS
export async function createInventoryExpiryNotification(
  sellerId: string,
  itemName: string,
  expiryMinutes: number,
  itemId: string
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(sellerId);
  if (!enabled) return;

  const data = {
    itemName,
    expiryMinutes,
    itemId,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "inventory_expiry",
    title: "⚠️ Item Expiring Soon",
    body: `${itemName} is expiring in ${expiryMinutes} minutes. Consider adding to a Mystery Bag.`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    sellerId,
    "inventory_expiry",
    "⚠️ Item Expiring Soon",
    `${itemName} in ${expiryMinutes} mins!`,
    data
  );

  return doc;
}

export async function createLowStockNotification(
  sellerId: string,
  itemName: string,
  quantity: number,
  itemId: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "low_stock",
    title: "📦 Low Stock Alert",
    body: `Only ${quantity} ${itemName} left in stock.`,
    data: {
      itemName,
      quantity,
      itemId,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createItemsExpiredNotification(
  sellerId: string,
  expiredCount: number
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "items_expired",
    title: "❌ Items Expired",
    body: `${expiredCount} items expired today. Review your baking quantities.`,
    data: {
      expiredCount,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createNewOrderNotification(
  sellerId: string,
  orderId: string,
  itemCount: number,
  pickupTime: string
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(sellerId);
  if (!enabled) return;

  const data = {
    orderId,
    itemCount,
    pickupTime,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "new_order",
    title: "🎉 New Order Received",
    body: `${itemCount} items scheduled for pickup at ${pickupTime}.`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/orders",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    sellerId,
    "new_order",
    "🎉 New Order",
    `${itemCount} items, pickup at ${pickupTime}`,
    data
  );

  return doc;
}

export async function createOrderCanceledNotification(
  sellerId: string,
  orderId: string,
  itemCount: number
) {
  const data = {
    orderId,
    itemCount,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "order_canceled",
    title: "❌ Order Canceled",
    body: `Customer canceled order. ${itemCount} items returned to inventory.`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/orders",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    sellerId,
    "order_canceled",
    "❌ Order Canceled",
    `${itemCount} items refunded to inventory`,
    data
  );

  return doc;
}

export async function createOrderPickupNotification(
  sellerId: string,
  orderId: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "order_pickup",
    title: "✅ Order Picked Up",
    body: `Order #${orderId} has been picked up successfully.`,
    data: {
      orderId,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/orders",
  });
}

export async function createHighDemandNotification(
  sellerId: string,
  itemName: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "high_demand",
    title: "📈 High Demand Detected",
    body: `High demand detected for ${itemName} today.`,
    data: {
      itemName,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createMysteryBagSellingNotification(
  sellerId: string,
  bagName: string,
  percentageSold: number
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(sellerId);
  if (!enabled) return;

  const data = {
    bagName,
    percentageSold,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "mystery_bag_selling",
    title: "🔥 Mystery Bag Selling Fast",
    body: `Your ${bagName} is selling fast — ${percentageSold}% claimed!`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    sellerId,
    "mystery_bag_selling",
    "🔥 Mystery Bag Hot!",
    `${bagName} - ${percentageSold}% sold!`,
    data
  );

  return doc;
}

export async function createNoMysteryBagsNotification(sellerId: string) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "no_mystery_bags",
    title: "⚠️ No Mystery Bags",
    body: "No Mystery Bags created today. Potential surplus risk detected.",
    data: {},
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createAISurplusWarningNotification(
  sellerId: string,
  reason: string
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(sellerId);
  if (!enabled) return;

  const data = {
    reason,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "ai_surplus_warning",
    title: "⚠️ AI: High Surplus Risk TODAY",
    body: `${reason}`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard?tab=ai",
  });

  // Trigger push notification (high priority)
  await handleNotificationDelivery(
    sellerId,
    "ai_surplus_warning",
    "🚨 High Surplus Risk TODAY",
    reason,
    data
  );

  return doc;
}

export async function createAIProductionReduceNotification(
  sellerId: string,
  itemName: string,
  percentReduction: number
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "ai_production_reduce",
    title: "📊 AI Production Insight",
    body: `AI suggests reducing ${itemName} production by ${percentReduction}% tomorrow.`,
    data: {
      itemName,
      percentReduction,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard?tab=ai",
  });
}

export async function createAIWeekendSpikeNotification(sellerId: string) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "ai_weekend_spike",
    title: "📈 AI Weekend Alert",
    body: "Weekend demand spike predicted — increase output for Saturday.",
    data: {},
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard?tab=ai",
  });
}

export async function createDailyReportNotification(
  sellerId: string,
  itemsSold: number,
  wasteCount: number,
  wastePercentage: number
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "daily_report",
    title: "📊 Daily Report Ready",
    body: `${itemsSold} sold, ${wasteCount} wasted (${wastePercentage}% surplus).`,
    data: {
      itemsSold,
      wasteCount,
      wastePercentage,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createTopItemNotification(
  sellerId: string,
  itemName: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "top_item",
    title: "💡 Top Selling Item",
    body: `${itemName} is your top-selling item today.`,
    data: {
      itemName,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createWasteIncreaseNotification(
  sellerId: string,
  increasePercentage: number
) {
  return addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "waste_increased",
    title: "⚠️ Waste Rate Increased",
    body: `Waste rate increased by ${increasePercentage}% compared to last week.`,
    data: {
      increasePercentage,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/dashboard",
  });
}

export async function createCustomerMessageNotification(
  sellerId: string,
  buyerName: string,
  messagePreview: string
) {
  const data = {
    buyerName,
    messagePreview,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: sellerId,
    userRole: "seller",
    type: "customer_message",
    title: "💬 New Message",
    body: `${buyerName}: "${messagePreview}"`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(seller)/sellerchat",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    sellerId,
    "customer_message",
    "💬 Message from " + buyerName,
    messagePreview,
    data
  );

  return doc;
}

// BUYER NOTIFICATIONS
export async function createNewBakeryNearbyNotification(
  buyerId: string,
  bakeryName: string,
  distance: number,
  location: { latitude: number; longitude: number }
) {
  const data = {
    bakeryName,
    distance,
    location,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "new_bakery_nearby",
    title: "📍 New Bakery Near You",
    body: `${bakeryName} added fresh items (${distance.toFixed(1)}km away)!`,
    data: {
      bakeryName,
      distance,
      location: { latitude: location.latitude, longitude: location.longitude },
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyermap",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "new_bakery_nearby",
    "📍 New Bakery Near You",
    `${bakeryName} - ${distance.toFixed(1)}km away`,
    data
  );

  return doc;
}

export async function createPopularDealNearbyNotification(
  buyerId: string,
  bakeryName: string,
  discount: number,
  distance: number
) {
  const data = {
    bakeryName,
    discount,
    distance,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "popular_deal_nearby",
    title: "🔥 Popular Deal Near You",
    body: `${discount}% off Mystery Bag at ${bakeryName} (${distance.toFixed(1)}km away)`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyermap",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "popular_deal_nearby",
    "🔥 " + discount + "% Off Nearby!",
    `${bakeryName} - ${distance.toFixed(1)}km away`,
    data
  );

  return doc;
}

export async function createExpiringItemsNearbyNotification(
  buyerId: string,
  itemCount: number,
  distance: number
) {
  return addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "expiring_items_nearby",
    title: "🚨 Expiring Items Nearby",
    body: `${itemCount} items expiring soon at a bakery ${distance.toFixed(1)}km away.`,
    data: {
      itemCount,
      distance,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyermap",
  });
}

export async function createOrderConfirmedNotification(
  buyerId: string,
  orderId: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "order_confirmed",
    title: "🛒 Order Confirmed",
    body: `Order #${orderId} has been confirmed!`,
    data: {
      orderId,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyerorders",
  });
}

export async function createPickupStartsNotification(
  buyerId: string,
  orderId: string,
  minutes: number
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(buyerId);
  if (!enabled) return;

  const data = {
    orderId,
    minutes,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "pickup_starts",
    title: "⏰ Pickup Starts Soon",
    body: `Your pickup starts in ${minutes} minutes for Order #${orderId}.`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyerorders",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "pickup_starts",
    "⏰ Pickup in " + minutes + " minutes!",
    `Order #${orderId} - Get there soon!`,
    data
  );

  return doc;
}

export async function createOrderReadyNotification(
  buyerId: string,
  orderId: string
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(buyerId);
  if (!enabled) return;

  const data = {
    orderId,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "order_ready",
    title: "📦 Order Ready for Pickup",
    body: `Order #${orderId} is ready to be picked up!`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyerorders",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "order_ready",
    "📦 Your Order is Ready!",
    `Pickup Order #${orderId} now`,
    data
  );

  return doc;
}

export async function createMysteryBagAvailableNotification(
  buyerId: string,
  bakeryName: string,
  price: number,
  itemCount: number
) {
  // Check if notifications are enabled
  const enabled = await areNotificationsEnabled(buyerId);
  if (!enabled) return;

  const data = {
    bakeryName,
    price,
    itemCount,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "mystery_bag_available",
    title: "🔥 Mystery Bag Available",
    body: `${bakeryName}: RM${price} for ${itemCount} items!`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyermap",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "mystery_bag_available",
    "🔥 Mystery Bag Alert!",
    `${bakeryName}: RM${price} - Tap to buy!`,
    data
  );

  return doc;
}

export async function createPriceDropNotification(
  buyerId: string,
  itemName: string,
  newPrice: number,
  oldPrice: number
) {
  const data = {
    itemName,
    newPrice,
    oldPrice,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "price_drop",
    title: "💸 Price Drop",
    body: `${itemName}: RM${oldPrice.toFixed(2)} → RM${newPrice.toFixed(2)}`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyerhome",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "price_drop",
    "💸 Price Down: RM" + newPrice.toFixed(2),
    `${itemName} - Hurry!`,
    data
  );

  return doc;
}

export async function createAIPersonalizedNotification(
  buyerId: string,
  itemName: string,
  bakeryName: string
) {
  return addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "ai_personalized",
    title: "🤖 Personalized Recommendation",
    body: `Based on your past orders, you might like today's ${itemName} deal at ${bakeryName}.`,
    data: {
      itemName,
      bakeryName,
    },
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyermap",
  });
}

export async function createPaymentSuccessNotification(
  buyerId: string,
  amount: number,
  orderId: string
) {
  const data = {
    amount,
    orderId,
  };

  const doc = await addDoc(collection(db, "notifications"), {
    userId: buyerId,
    userRole: "buyer",
    type: "payment_success",
    title: "💳 Payment Successful",
    body: `RM${amount.toFixed(2)} charged for Order #${orderId}. Receipt available.`,
    data,
    read: false,
    createdAt: Timestamp.now(),
    actionUrl: "/(buyer)/buyerorders",
  });

  // Trigger push notification
  await handleNotificationDelivery(
    buyerId,
    "payment_success",
    "💳 Payment Confirmed",
    `RM${amount.toFixed(2)} - Order #${orderId}`,
    data
  );

  return doc;
}

// FETCH NOTIFICATIONS
export async function getUserNotifications(
  userId: string,
  limit_count: number = 20,
  onlyUnread: boolean = false
) {
  let q;
  if (onlyUnread) {
    q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false),
      orderBy("createdAt", "desc"),
      limit(limit_count)
    );
  } else {
    q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limit_count)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as (Notification & { id: string })[];
}

export async function markNotificationAsRead(notificationId: string) {
  const docRef = doc(db, "notifications", notificationId);
  return updateDoc(docRef, { read: true });
}

export async function deleteNotification(notificationId: string) {
  return deleteDoc(doc(db, "notifications", notificationId));
}

export async function clearAllNotifications(userId: string) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map((doc) =>
    deleteDoc(doc.ref)
  );
  return Promise.all(deletePromises);
}

// ============================================
// DEVICE TOKEN MANAGEMENT FOR PUSH NOTIFICATIONS
// ============================================

export async function saveDeviceToken(userId: string, token: string) {
  try {
    await setDoc(
      doc(db, "deviceTokens", userId),
      {
        token,
        updatedAt: Timestamp.now(),
        platform: "mobile",
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving device token:", error);
  }
}

export async function getDeviceToken(userId: string): Promise<string | null> {
  try {
    const docRef = doc(db, "deviceTokens", userId);
    const docSnap = await getDocs(query(collection(db, "deviceTokens"), where("userId", "==", userId)));
    if (docSnap.size > 0) {
      return docSnap.docs[0].data().token || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting device token:", error);
    return null;
  }
}

// ============================================
// PUSH NOTIFICATION FUNCTIONS
// ============================================

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // In production, this would call your backend to send via FCM
    // For now, we store push notification metadata
    await addDoc(collection(db, "pushNotifications"), {
      userId,
      title,
      body,
      data: data || {},
      sentAt: Timestamp.now(),
      status: "queued",
    });

    console.log(`Push notification queued for ${userId}: ${title}`);
  } catch (error) {
    console.error("Error queuing push notification:", error);
  }
}

// Helper to determine if notification should be pushed
export async function handleNotificationDelivery(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const delivery = NOTIFICATION_DELIVERY[type] || "in-app";

  if (delivery === "push" || delivery === "both") {
    // Send push notification
    await sendPushNotification(userId, title, body, {
      type,
      ...(data && Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      )),
    });
  }
}

// ============================================
// CHECK IF USER HAS NOTIFICATIONS ENABLED
// ============================================

export async function areNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    // Import user service to get profile
    const { getUserProfile } = await import("./user");
    const profile = await getUserProfile(userId);
    
    // Return notifications setting, default to true if not set
    return profile?.settings?.notifications ?? true;
  } catch (error) {
    console.error("Error checking notification setting:", error);
    // Default to true if there's an error
    return true;
  }
}
