import type { InventoryItem } from "@/src/services/firebase/inventoryServices";
import {
  hoursUntil,
  isListingExpired,
  resolveExpiryDate,
} from "@/src/services/pricing/dynamicPricing";
import {
  combineExpiryAt,
  formatDisplayDate,
  formatDisplayTime,
  formatIsoDate,
  hoursUntilExpiry,
} from "@/src/utils/inventoryFormUtils";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "listing-1",
    sellerId: "seller-1",
    name: "Croissant Box",
    type: "bag",
    category: "Bakery",
    quantity: 5,
    price: 10,
    expiryDate: "",
    status: "active",
    createdAt: undefined as never,
    updatedAt: undefined as never,
    ...overrides,
  };
}

describe("Expiry date handling", () => {
  describe("resolveExpiryDate", () => {
    it("uses the expiryTime Date when present", () => {
      const expiry = new Date(2026, 5, 15, 18, 30, 0);
      const item = makeItem({ expiryTime: expiry as never });
      expect(resolveExpiryDate(item)).toEqual(expiry);
    });

    it("converts a Firestore Timestamp via toDate()", () => {
      const expiry = new Date(2026, 5, 15, 18, 30, 0);
      const timestamp = { toDate: () => expiry };
      const item = makeItem({ expiryTime: timestamp as never });
      expect(resolveExpiryDate(item)).toEqual(expiry);
    });

    it("converts a raw { seconds } timestamp object", () => {
      const expiry = new Date(2026, 5, 15, 18, 30, 0);
      const item = makeItem({
        expiryTime: { seconds: expiry.getTime() / 1000 } as never,
      });
      expect(resolveExpiryDate(item)).toEqual(expiry);
    });

    it("treats a YYYY-MM-DD string as end of that day", () => {
      const item = makeItem({ expiryDate: "2026-06-15" });
      expect(resolveExpiryDate(item)).toEqual(
        new Date(2026, 5, 15, 23, 59, 59, 999),
      );
    });

    it("treats a DD/MM/YYYY string as end of that day", () => {
      const item = makeItem({ expiryDate: "15/06/2026" });
      expect(resolveExpiryDate(item)).toEqual(
        new Date(2026, 5, 15, 23, 59, 59, 999),
      );
    });

    it('parses "date, time" strings with AM/PM', () => {
      const item = makeItem({ expiryDate: "2026-06-15, 5:30 PM" });
      expect(resolveExpiryDate(item)).toEqual(new Date(2026, 5, 15, 17, 30, 0));
    });

    it("parses ISO date-time strings", () => {
      const item = makeItem({ expiryDate: "2026-06-15T14:45" });
      expect(resolveExpiryDate(item)).toEqual(new Date(2026, 5, 15, 14, 45, 0));
    });

    it("returns null when there is no expiry information", () => {
      expect(resolveExpiryDate(makeItem({ expiryDate: "" }))).toBeNull();
      expect(resolveExpiryDate(makeItem({ expiryDate: "   " }))).toBeNull();
    });

    it("returns null for unparseable strings", () => {
      expect(resolveExpiryDate(makeItem({ expiryDate: "not-a-date" }))).toBeNull();
    });
  });

  describe("isListingExpired", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);

    it("flags a listing whose expiry instant has passed", () => {
      const item = makeItem({ expiryTime: new Date(2026, 5, 15, 11, 0, 0) as never });
      expect(isListingExpired(item, now)).toBe(true);
    });

    it("keeps a listing live before its expiry instant", () => {
      const item = makeItem({ expiryTime: new Date(2026, 5, 15, 13, 0, 0) as never });
      expect(isListingExpired(item, now)).toBe(false);
    });

    it("never expires a listing without an expiry date", () => {
      expect(isListingExpired(makeItem({ expiryDate: "" }), now)).toBe(false);
    });

    it("keeps a same-day YYYY-MM-DD listing live until end of day", () => {
      const item = makeItem({ expiryDate: "2026-06-15" });
      expect(isListingExpired(item, now)).toBe(false);
      expect(isListingExpired(item, new Date(2026, 5, 16, 0, 0, 0))).toBe(true);
    });
  });

  describe("hoursUntil / hoursUntilExpiry", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);

    it("returns the hours remaining until expiry", () => {
      expect(hoursUntil(new Date(2026, 5, 15, 15, 0, 0), now)).toBe(3);
      expect(hoursUntilExpiry(new Date(2026, 5, 15, 15, 0, 0), now)).toBe(3);
    });

    it("returns fractional hours", () => {
      expect(hoursUntil(new Date(2026, 5, 15, 12, 30, 0), now)).toBe(0.5);
    });

    it("returns a negative number once expired", () => {
      expect(hoursUntilExpiry(new Date(2026, 5, 15, 10, 0, 0), now)).toBe(-2);
    });
  });

  describe("expiry form helpers", () => {
    it("formats display dates as DD/MM/YYYY", () => {
      expect(formatDisplayDate(new Date(2026, 5, 15))).toBe("15/06/2026");
      expect(formatDisplayDate(new Date(2026, 0, 1))).toBe("01/01/2026");
    });

    it("formats display times in 12-hour clock", () => {
      expect(formatDisplayTime(new Date(2026, 5, 15, 17, 5))).toBe("5:05 PM");
      expect(formatDisplayTime(new Date(2026, 5, 15, 0, 0))).toBe("12:00 AM");
      expect(formatDisplayTime(new Date(2026, 5, 15, 12, 0))).toBe("12:00 PM");
    });

    it("formats Firestore dates as YYYY-MM-DD", () => {
      expect(formatIsoDate(new Date(2026, 5, 15))).toBe("2026-06-15");
    });

    it("combines the date picker and time picker into one expiry instant", () => {
      const datePart = new Date(2026, 5, 15, 1, 2, 3);
      const timePart = new Date(2000, 0, 1, 17, 30, 45);
      expect(combineExpiryAt(datePart, timePart)).toEqual(
        new Date(2026, 5, 15, 17, 30, 0, 0),
      );
    });

    it("round-trips a combined expiry through the resolver", () => {
      // Same flow as AddBagModal: picker values -> stored strings -> resolved expiry
      const expiryAt = combineExpiryAt(
        new Date(2026, 5, 15),
        new Date(2000, 0, 1, 17, 30),
      );
      const stored = `${formatIsoDate(expiryAt)}, ${formatDisplayTime(expiryAt)}`;
      const resolved = resolveExpiryDate(makeItem({ expiryDate: stored }));
      expect(resolved).toEqual(expiryAt);
    });

    it("supports the 'expiry must be in the future' form rule", () => {
      const now = new Date(2026, 5, 15, 12, 0, 0);
      const future = combineExpiryAt(new Date(2026, 5, 15), new Date(2000, 0, 1, 18, 0));
      const past = combineExpiryAt(new Date(2026, 5, 15), new Date(2000, 0, 1, 9, 0));

      expect(hoursUntilExpiry(future, now)).toBeGreaterThan(0);
      expect(hoursUntilExpiry(past, now)).toBeLessThanOrEqual(0);
    });
  });
});
