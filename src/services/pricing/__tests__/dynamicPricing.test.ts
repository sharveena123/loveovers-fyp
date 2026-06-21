import type { InventoryItem } from "@/src/services/firebase/inventoryServices";
import {
  abVariantFromListingId,
  computeExtraMarkdownPct,
  computeInitialListingAnchor,
  computeLiveListingPrice,
  isSmartPricingEnabled,
  resolveListingRetail,
  suggestedSimulatorDiscountPct,
} from "@/src/services/pricing/dynamicPricing";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "listing-1",
    sellerId: "seller-1",
    name: "Surprise Bag",
    type: "bag",
    category: "Bakery",
    quantity: 10,
    sold: 0,
    price: 10,
    originalPrice: 10,
    discountedPrice: 8,
    expiryDate: "",
    status: "active",
    createdAt: undefined as never,
    updatedAt: undefined as never,
    ...overrides,
  };
}

describe("Dynamic pricing calculation", () => {
  describe("abVariantFromListingId", () => {
    it("is deterministic for the same listing + seller", () => {
      const first = abVariantFromListingId("listing-1", "seller-1");
      const second = abVariantFromListingId("listing-1", "seller-1");
      expect(first).toBe(second);
    });

    it("always returns 0 or 1", () => {
      const ids = ["a", "b", "abc123", "listing-99", ""];
      for (const id of ids) {
        expect([0, 1]).toContain(abVariantFromListingId(id, "seller-x"));
      }
    });
  });

  describe("computeExtraMarkdownPct", () => {
    it("combines expiry urgency and stock pressure outside the closing window", () => {
      const result = computeExtraMarkdownPct({
        hoursToExpiry: 1.5, // <= 2h -> urgency 28
        remainingFraction: 0.9, // >= 0.85 -> stock pressure 12
        hourOfDay: 10, // before closing window
        closingHour: 20,
        abVariant: 0,
      });

      expect(result.expiryUrgency).toBe(28);
      expect(result.stockPressure).toBe(12);
      expect(result.closingWindow).toBe(0);
      expect(result.abBoost).toBe(0);
      // 28 * 1.0 + 12 * 0.85 = 38.2
      expect(result.extraMarkdownPct).toBe(38.2);
    });

    it("caps the markdown at 52% even when every signal is maxed", () => {
      const result = computeExtraMarkdownPct({
        hoursToExpiry: 0, // expired -> urgency 45
        remainingFraction: 1, // full stock -> 12
        hourOfDay: 21, // past closing -> 18
        closingHour: 20,
        abVariant: 1, // +5 boost
      });

      expect(result.extraMarkdownPct).toBe(52);
    });

    it("returns 0% for fresh, low-stock listings in the morning", () => {
      const result = computeExtraMarkdownPct({
        hoursToExpiry: 200, // > 168h -> no urgency
        remainingFraction: 0.1, // < 0.25 -> no pressure
        hourOfDay: 9,
        closingHour: 20,
        abVariant: 0,
      });

      expect(result.extraMarkdownPct).toBe(0);
    });

    it("ramps the closing window discount as closing time approaches", () => {
      const base = {
        hoursToExpiry: 200,
        remainingFraction: 0,
        closingHour: 20,
        abVariant: 0 as const,
      };

      const early = computeExtraMarkdownPct({ ...base, hourOfDay: 16 });
      const ramp = computeExtraMarkdownPct({ ...base, hourOfDay: 18 });
      const closed = computeExtraMarkdownPct({ ...base, hourOfDay: 21 });

      expect(early.closingWindow).toBe(0);
      expect(ramp.closingWindow).toBeGreaterThan(6);
      expect(closed.closingWindow).toBe(18);
      expect(early.extraMarkdownPct).toBeLessThan(ramp.extraMarkdownPct);
      expect(ramp.extraMarkdownPct).toBeLessThan(closed.extraMarkdownPct);
    });

    it("increases markdown as expiry gets closer", () => {
      const base = {
        remainingFraction: 0.5,
        hourOfDay: 10,
        closingHour: 20,
        abVariant: 0 as const,
      };

      const week = computeExtraMarkdownPct({ ...base, hoursToExpiry: 150 });
      const day = computeExtraMarkdownPct({ ...base, hoursToExpiry: 20 });
      const lastHours = computeExtraMarkdownPct({ ...base, hoursToExpiry: 1 });

      expect(week.extraMarkdownPct).toBeLessThan(day.extraMarkdownPct);
      expect(day.extraMarkdownPct).toBeLessThan(lastHours.extraMarkdownPct);
    });
  });

  describe("computeLiveListingPrice", () => {
    const options = {
      now: new Date(2026, 5, 12, 10, 0, 0),
      closingHour: 20,
      listingId: "listing-1",
      sellerId: "seller-1",
    };

    it("returns the seller list floor untouched when smart pricing is off", () => {
      const item = makeItem({
        type: "item",
        smartPricingEnabled: false,
        price: 10,
        originalPrice: 12,
        discountedPrice: 8,
      });

      const result = computeLiveListingPrice(item, options);

      expect(result.price).toBe(8);
      expect(result.discountedPrice).toBe(8);
      expect(result.originalPrice).toBe(12);
      expect(result.smartLiveMarkdownPct).toBe(0);
      expect(result.smartPricingApplied).toBe(false);
    });

    it("applies the live markdown on top of the list floor for smart bags", () => {
      const item = makeItem({
        type: "bag",
        price: 10,
        originalPrice: 12,
        discountedPrice: 8,
        // Expires in 1 hour -> strong urgency markdown
        expiryDate: "",
        expiryTime: new Date(2026, 5, 12, 11, 0, 0) as never,
      });

      const result = computeLiveListingPrice(item, options);

      expect(result.smartPricingApplied).toBe(true);
      expect(result.smartLiveMarkdownPct).toBeGreaterThan(0);
      expect(result.price).toBeLessThan(8); // cheaper than seller floor
      expect(result.originalPrice).toBe(12);
      // Live price always matches the reported markdown % (rounded to cents)
      const expected = Math.round(8 * (1 - result.smartLiveMarkdownPct / 100) * 100) / 100;
      expect(result.price).toBeCloseTo(Math.max(expected, 12 * 0.28), 2);
    });

    it("never drops below 28% of retail (price floor protection)", () => {
      const item = makeItem({
        type: "bag",
        price: 10,
        originalPrice: 10,
        discountedPrice: 3,
        expiryTime: new Date(2026, 5, 12, 9, 0, 0) as never, // already expired
      });

      const lateOptions = { ...options, now: new Date(2026, 5, 12, 21, 0, 0) };
      const result = computeLiveListingPrice(item, lateOptions);

      // Max markdown 52% would give 1.44, but floor is 10 * 0.28 = 2.80
      expect(result.smartLiveMarkdownPct).toBe(52);
      expect(result.price).toBe(2.8);
    });
  });

  describe("computeInitialListingAnchor", () => {
    it("discounts 34% off retail when expiring within 24 hours", () => {
      expect(computeInitialListingAnchor(10, 12)).toBe(6.6);
    });

    it("discounts 30% off retail when expiring within 72 hours", () => {
      expect(computeInitialListingAnchor(10, 48)).toBe(7);
    });

    it("discounts 26% off retail for longer-dated listings", () => {
      expect(computeInitialListingAnchor(10, 100)).toBe(7.4);
    });
  });

  describe("resolveListingRetail", () => {
    it("prefers originalPrice when it is above the list floor", () => {
      expect(
        resolveListingRetail({ price: 10, originalPrice: 12, discountedPrice: 8 }, 8),
      ).toBe(12);
    });

    it("falls back to raw price when originalPrice is missing", () => {
      expect(resolveListingRetail({ price: 10, discountedPrice: 8 }, 8)).toBe(10);
    });

    it("synthesises a retail above the floor for legacy docs", () => {
      // max(8 * 1.15, 8 + 0.5) = 9.2
      expect(resolveListingRetail({ price: 8, discountedPrice: 8 }, 8)).toBe(9.2);
      // max(2 * 1.15, 2 + 0.5) = 2.5
      expect(resolveListingRetail({ price: 2, discountedPrice: 2 }, 2)).toBe(2.5);
    });
  });

  describe("isSmartPricingEnabled", () => {
    it("defaults to enabled for bags", () => {
      expect(isSmartPricingEnabled(makeItem({ type: "bag" }))).toBe(true);
    });

    it("respects an explicit opt-out on bags", () => {
      expect(
        isSmartPricingEnabled(makeItem({ type: "bag", smartPricingEnabled: false })),
      ).toBe(false);
    });

    it("defaults to disabled for plain items unless opted in", () => {
      expect(isSmartPricingEnabled(makeItem({ type: "item" }))).toBe(false);
      expect(
        isSmartPricingEnabled(makeItem({ type: "item", smartPricingEnabled: true })),
      ).toBe(true);
    });
  });

  describe("suggestedSimulatorDiscountPct", () => {
    it.each([
      [9, 5],
      [13, 8],
      [18, 12],
      [19, 17],
      [21, 22],
    ])("suggests the right discount at %i:00 (closing 20:00)", (hour, expected) => {
      expect(suggestedSimulatorDiscountPct(new Date(2026, 5, 12, hour, 0), 20)).toBe(
        expected,
      );
    });
  });
});
