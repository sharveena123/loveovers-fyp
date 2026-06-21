import type { BuyerOrder } from "@/src/services/firebase/orders";
import { buildOrderReceiptHtml } from "@/src/utils/orderReceipt";

describe("orderReceipt", () => {
  const sampleOrder: BuyerOrder = {
    id: "order123456789",
    userId: "user1",
    items: [
      {
        id: "item1",
        name: "Mystery bag",
        price: 12.5,
        quantity: 2,
        sellerId: "seller1",
        sellerName: "Test Café",
      },
    ],
    subtotal: 25,
    total: 22.5,
    discount: 2.5,
    shippingAddress: {
      fullName: "Jane Buyer",
      email: "jane@example.com",
      phone: "0123456789",
      street: "1 Jalan Test",
      city: "KL",
      state: "WP",
      postalCode: "50000",
    },
    paymentIntentId: "pi_test_123",
    paymentStatus: "succeeded",
    orderStatus: "delivered",
    createdAt: new Date("2026-06-15T10:30:00"),
    updatedAt: new Date("2026-06-15T10:30:00"),
  };

  it("builds receipt HTML with order details", () => {
    const html = buildOrderReceiptHtml(sampleOrder);
    expect(html).toContain("LoveOvers");
    expect(html).toContain("#ORDER123");
    expect(html).toContain("Mystery bag");
    expect(html).toContain("Test Café");
    expect(html).toContain("RM22.50");
    expect(html).toContain("Jane Buyer");
  });
});
