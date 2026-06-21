/**
 * System tests — validate complete end-to-end workflows.
 *
 * Unlike the unit tests (which test one function at a time), every scenario
 * here drives the real service layer through a full user journey. All
 * services share one in-memory Firestore (see helpers/inMemoryFirestore.ts),
 * so buyer-side and seller-side code genuinely interact through the same
 * database documents — exactly as they do in production.
 *
 * Key scenarios tested:
 *  1. Buyer checkout process       — browse cart → checkout → orders created
 *  2. Seller listing creation      — add item/bag → visible & purchasable
 *  3. Order status synchronization — seller updates → buyer order mirrors it
 *  4. Buyer-seller messaging       — conversation, unread counts, read flow
 */

jest.mock("firebase/firestore", () => require("./helpers/inMemoryFirestore"));

jest.mock("@/src/services/firebase/config", () => ({
  db: {},
  auth: {},
  storage: {},
}));

jest.mock("expo-location", () => ({
  geocodeAsync: jest.fn(async () => []),
}));

import {
  addToCart,
  clearCart,
  getUserCart,
} from "@/src/services/firebase/cartServices";
import {
  inventoryService,
  isActiveListing,
  orderService,
} from "@/src/services/firebase/inventoryServices";
import {
  createConversation,
  getConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  subscribeToMessages,
} from "@/src/services/firebase/messagingServices";
import {
  createOrderFromCart,
  getBuyerOrders,
  getOrder,
  getSellerOrders,
  OrderItem,
  ShippingAddress,
} from "@/src/services/firebase/orders";
import {
  __getCollectionData,
  __resetFirestore,
} from "./helpers/inMemoryFirestore";

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const SHIPPING_ADDRESS: ShippingAddress = {
  fullName: "Aina Rahman",
  email: "aina@example.com",
  phone: "0123456789",
  street: "12 Jalan Bunga",
  city: "Kuala Lumpur",
  state: "WP Kuala Lumpur",
  postalCode: "50000",
};

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ===========================================================================
// Scenario 1 — Buyer checkout process
// ===========================================================================
describe("System: buyer checkout process", () => {
  const BUYER = "buyer-checkout";

  beforeAll(() => __resetFirestore());

  it("buyer adds items from two different sellers to the cart", async () => {
    await addToCart(BUYER, {
      id: "item-croissant",
      name: "Croissant Box",
      sellerName: "Bake House",
      sellerId: "seller-bakehouse",
      price: 12,
      originalPrice: 24,
      quantity: 2,
      type: "item",
      imageUrl: "https://example.com/croissant.jpg",
    });
    await addToCart(BUYER, {
      id: "bag-mystery",
      name: "Mystery Bag",
      sellerName: "Cake Corner",
      sellerId: "seller-cakecorner",
      price: 15,
      quantity: 1,
      type: "bag",
    });

    const cart = await getUserCart(BUYER);
    expect(cart).toHaveLength(2);
    expect(cart.map((i) => i.sellerId).sort()).toEqual([
      "seller-bakehouse",
      "seller-cakecorner",
    ]);
  });

  it("adding the same item again merges quantities instead of duplicating", async () => {
    await addToCart(BUYER, {
      id: "item-croissant",
      name: "Croissant Box",
      sellerName: "Bake House",
      sellerId: "seller-bakehouse",
      price: 12,
      quantity: 1,
      type: "item",
    });

    const cart = await getUserCart(BUYER);
    expect(cart).toHaveLength(2);
    const croissant = cart.find((i) => i.id === "item-croissant");
    expect(croissant?.quantity).toBe(3);
  });

  let orderId: string;

  it("checkout creates the buyer order with a successful payment", async () => {
    const cart = await getUserCart(BUYER);
    const orderItems: OrderItem[] = cart.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      sellerId: i.sellerId,
      sellerName: i.sellerName,
      type: i.type,
    }));
    const subtotal = orderItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );

    orderId = await createOrderFromCart(
      BUYER,
      orderItems,
      subtotal,
      subtotal,
      0,
      SHIPPING_ADDRESS,
      "pi_test_checkout_123",
    );

    const order = await getOrder(BUYER, orderId);
    expect(order).not.toBeNull();
    expect(order!.paymentStatus).toBe("succeeded");
    expect(order!.orderStatus).toBe("pending");
    expect(order!.subtotal).toBe(12 * 3 + 15);
    expect(order!.shippingAddress.fullName).toBe("Aina Rahman");
    expect(order!.items).toHaveLength(2);
  });

  it("checkout splits the order per seller with the correct subtotals", async () => {
    const bakehouseOrders = (await getSellerOrders("seller-bakehouse")) as any[];
    const cakecornerOrders = (await getSellerOrders("seller-cakecorner")) as any[];

    expect(bakehouseOrders).toHaveLength(1);
    expect(bakehouseOrders[0].orderId).toBe(orderId);
    expect(bakehouseOrders[0].buyerId).toBe(BUYER);
    expect(bakehouseOrders[0].status).toBe("pending");
    expect(bakehouseOrders[0].total).toBe(12 * 3);

    expect(cakecornerOrders).toHaveLength(1);
    expect(cakecornerOrders[0].total).toBe(15);
    expect(cakecornerOrders[0].customerName).toBe("Aina Rahman");
  });

  it("cart is cleared after a completed checkout", async () => {
    await clearCart(BUYER);
    expect(await getUserCart(BUYER)).toEqual([]);
  });
});

// ===========================================================================
// Scenario 2 — Seller listing creation
// ===========================================================================
describe("System: seller listing creation", () => {
  const SELLER = "seller-listing";

  beforeAll(() => __resetFirestore());

  it("seller creates an individual item listing that appears in inventory", async () => {
    await inventoryService.addItem(SELLER, {
      name: "Sourdough Loaf",
      category: "Bread",
      quantity: 5,
      price: 8,
      originalPrice: 15,
      expiryDate: toDateString(daysFromNow(3)),
      expiryAt: daysFromNow(3),
      imageUrl: "https://example.com/sourdough.jpg",
    });

    const inventory = await inventoryService.getInventory(SELLER);
    expect(inventory).toHaveLength(1);

    const item = inventory[0];
    expect(item.name).toBe("Sourdough Loaf");
    expect(item.type).toBe("item");
    expect(item.status).toBe("fresh");
    expect(item.sold).toBe(0);
    expect(item.price).toBe(8);
    expect(item.originalPrice).toBe(15);
  });

  it("seller creates a mystery bag with smart pricing enabled by default", async () => {
    const expiry = daysFromNow(1);
    await inventoryService.addBag(SELLER, {
      name: "Surprise Pastry Bag",
      category: "Bakery",
      quantity: 3,
      originalPrice: 30,
      discountedPrice: 10,
      expiryDate: toDateString(expiry),
      expiryTime: "21:00",
    });

    const inventory = await inventoryService.getInventory(SELLER);
    const bag = inventory.find((i) => i.type === "bag");
    expect(bag).toBeDefined();
    expect(bag!.smartPricingEnabled).toBe(true);
    expect(bag!.price).toBe(10);
    expect(bag!.discountedPrice).toBe(10);
  });

  it("new listings are visible on the buyer's active feed", async () => {
    const inventory = await inventoryService.getInventory(SELLER);
    expect(inventory).toHaveLength(2);
    for (const listing of inventory) {
      expect(isActiveListing(listing)).toBe(true);
    }
  });

  it("rejects a listing without a name or an image", async () => {
    await expect(
      inventoryService.addItem(SELLER, {
        name: "   ",
        category: "Bread",
        quantity: 1,
        price: 5,
        expiryDate: toDateString(daysFromNow(2)),
        expiryAt: daysFromNow(2),
        imageUrl: "https://example.com/x.jpg",
      }),
    ).rejects.toThrow("Item name is required");

    await expect(
      inventoryService.addItem(SELLER, {
        name: "Bagel",
        category: "Bread",
        quantity: 1,
        price: 5,
        expiryDate: toDateString(daysFromNow(2)),
        expiryAt: daysFromNow(2),
        imageUrl: "",
      }),
    ).rejects.toThrow("Item image is required");

    // Invalid listings never reach the database
    expect(await inventoryService.getInventory(SELLER)).toHaveLength(2);
  });

  it("a listing disappears from the active feed once it sells out", async () => {
    const inventory = await inventoryService.getInventory(SELLER);
    const item = inventory.find((i) => i.name === "Sourdough Loaf")!;

    await inventoryService.updateItem(SELLER, item.id!, { sold: item.quantity });

    const updated = (await inventoryService.getInventory(SELLER)).find(
      (i) => i.id === item.id,
    )!;
    expect(isActiveListing(updated)).toBe(false);
  });

  it("expired listings are removed automatically by the status sweep", async () => {
    await inventoryService.addItem(SELLER, {
      name: "Yesterday's Muffins",
      category: "Pastries",
      quantity: 4,
      price: 3,
      expiryDate: toDateString(daysFromNow(-1)),
      expiryAt: daysFromNow(-1),
      imageUrl: "https://example.com/muffins.jpg",
    });
    expect(await inventoryService.getInventory(SELLER)).toHaveLength(3);

    const deletedCount = await inventoryService.updateItemStatuses(SELLER);

    expect(deletedCount).toBe(1);
    const names = (await inventoryService.getInventory(SELLER)).map(
      (i) => i.name,
    );
    expect(names).not.toContain("Yesterday's Muffins");
  });
});

// ===========================================================================
// Scenario 3 — Order status synchronization (seller → buyer)
// ===========================================================================
describe("System: order status synchronization", () => {
  const BUYER = "buyer-sync";
  const SELLER = "seller-sync";
  let buyerOrderId: string;
  let sellerOrderDocId: string;

  beforeAll(async () => {
    __resetFirestore();

    const items: OrderItem[] = [
      {
        id: "item-tart",
        name: "Egg Tart Box",
        price: 9,
        quantity: 2,
        sellerId: SELLER,
        sellerName: "Tart Studio",
        type: "item",
      },
    ];
    buyerOrderId = await createOrderFromCart(
      BUYER,
      items,
      18,
      18,
      0,
      SHIPPING_ADDRESS,
      "pi_test_sync_456",
    );
  });

  it("seller receives the order linked to the buyer's order document", async () => {
    const sellerOrders = (await orderService.getOrders(SELLER)) as any[];
    expect(sellerOrders).toHaveLength(1);
    expect(sellerOrders[0].orderId).toBe(buyerOrderId);
    expect(sellerOrders[0].status).toBe("pending");
    sellerOrderDocId = sellerOrders[0].id!;
  });

  it("seller marking the order ready updates the buyer's order status", async () => {
    await orderService.updateOrderStatus(SELLER, sellerOrderDocId, "ready");

    const buyerOrder = await getOrder(BUYER, buyerOrderId);
    expect(buyerOrder!.orderStatus).toBe("ready");
  });

  it("seller completing the order shows as delivered for the buyer", async () => {
    await orderService.updateOrderStatus(SELLER, sellerOrderDocId, "completed");

    const buyerOrder = await getOrder(BUYER, buyerOrderId);
    expect(buyerOrder!.orderStatus).toBe("delivered");
  });

  it("buyer order self-heals on load when the seller-side write could not reach it", async () => {
    // Simulate a seller status change that never reached the buyer document
    // (e.g. security rules blocked the cross-user write).
    const sellerOrders = __getCollectionData(`sellers/${SELLER}/orders`);
    sellerOrders.get(sellerOrderDocId)!.status = "cancelled";
    const buyerDocBefore = await getOrder(BUYER, buyerOrderId);
    expect(buyerDocBefore!.orderStatus).toBe("delivered"); // still stale

    const orders = await getBuyerOrders(BUYER);
    expect(orders.find((o) => o.id === buyerOrderId)!.orderStatus).toBe(
      "cancelled",
    );

    // The corrected status is also persisted back to Firestore.
    await flushAsync();
    const persisted = await getOrder(BUYER, buyerOrderId);
    expect(persisted!.orderStatus).toBe("cancelled");
  });
});

// ===========================================================================
// Scenario 4 — Buyer-seller messaging
// ===========================================================================
describe("System: buyer-seller messaging", () => {
  const BUYER = "buyer-chat";
  const SELLER = "seller-chat";
  let conversationId: string;

  beforeAll(() => __resetFirestore());

  it("buyer starts a conversation with the seller", async () => {
    conversationId = await createConversation(
      BUYER,
      "Aina Rahman",
      SELLER,
      "Bake House",
      "order-123",
    );

    const conversation = await getConversation(conversationId);
    expect(conversation).not.toBeNull();
    expect(conversation!.buyerName).toBe("Aina Rahman");
    expect(conversation!.sellerName).toBe("Bake House");
    expect(conversation!.buyerUnreadCount).toBe(0);
    expect(conversation!.sellerUnreadCount).toBe(0);
  });

  it("starting the same conversation again reuses the existing thread", async () => {
    const secondId = await createConversation(
      BUYER,
      "Aina Rahman",
      SELLER,
      "Bake House",
    );
    expect(secondId).toBe(conversationId);
  });

  it("buyer's message reaches the seller and raises their unread badge", async () => {
    await sendMessage(
      conversationId,
      BUYER,
      "Aina Rahman",
      "buyer",
      "Is this item still available?",
      true,
    );

    const conversation = await getConversation(conversationId);
    expect(conversation!.lastMessage).toBe("Is this item still available?");
    expect(conversation!.lastMessageSenderId).toBe(BUYER);
    expect(conversation!.sellerUnreadCount).toBe(1);
    expect(conversation!.buyerUnreadCount).toBe(0);
  });

  it("seller's reply raises the buyer's unread badge", async () => {
    await sendMessage(
      conversationId,
      SELLER,
      "Bake House",
      "seller",
      "Item is available and ready to ship",
    );

    const conversation = await getConversation(conversationId);
    expect(conversation!.buyerUnreadCount).toBe(1);
    expect(conversation!.sellerUnreadCount).toBe(1);
  });

  it("messages are delivered to both parties in chronological order", async () => {
    const messages = await getMessages(conversationId);
    expect(messages.map((m) => m.sendersRole)).toEqual(["buyer", "seller"]);
    expect(messages.map((m) => m.text)).toEqual([
      "Is this item still available?",
      "Item is available and ready to ship",
    ]);
    expect(messages.every((m) => m.read === false)).toBe(true);
  });

  it("opening the chat marks the other party's messages as read", async () => {
    await markConversationAsRead(conversationId, "seller");

    const conversation = await getConversation(conversationId);
    expect(conversation!.sellerUnreadCount).toBe(0);
    expect(conversation!.buyerUnreadCount).toBe(1); // buyer hasn't read yet

    const messages = await getMessages(conversationId);
    const buyerMessage = messages.find((m) => m.sendersRole === "buyer")!;
    const sellerMessage = messages.find((m) => m.sendersRole === "seller")!;
    expect(buyerMessage.read).toBe(true);
    expect(sellerMessage.read).toBe(false);

    await markConversationAsRead(conversationId, "buyer");
    const updated = await getConversation(conversationId);
    expect(updated!.buyerUnreadCount).toBe(0);
  });

  it("a live message subscription delivers new messages in real time", async () => {
    const snapshots: string[][] = [];
    const unsubscribe = subscribeToMessages(conversationId, (messages) => {
      snapshots.push(messages.map((m) => m.text));
    });

    expect(snapshots[snapshots.length - 1]).toHaveLength(2); // initial snapshot

    await sendMessage(
      conversationId,
      BUYER,
      "Aina Rahman",
      "buyer",
      "Great, I'll pick it up at 6pm",
    );
    unsubscribe();

    expect(snapshots[snapshots.length - 1]).toContain(
      "Great, I'll pick it up at 6pm",
    );
  });

  it("the conversation appears in both inboxes with the latest message", async () => {
    const buyerInbox = await getConversations(BUYER, "buyer");
    const sellerInbox = await getConversations(SELLER, "seller");

    expect(buyerInbox).toHaveLength(1);
    expect(sellerInbox).toHaveLength(1);
    expect(buyerInbox[0].id).toBe(conversationId);
    expect(sellerInbox[0].lastMessage).toBe("Great, I'll pick it up at 6pm");
  });
});
