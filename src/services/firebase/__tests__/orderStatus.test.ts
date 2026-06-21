jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
}));

jest.mock("../config", () => ({ db: {} }));

import {
  aggregateSellerStatuses,
  sellerStatusToBuyerOrderStatus,
} from "../orders";

describe("Order status mapping", () => {
  describe("sellerStatusToBuyerOrderStatus", () => {
    it.each([
      ["pending", "pending"],
      ["ready", "ready"],
      ["confirmed", "confirmed"],
      ["completed", "delivered"],
      ["cancelled", "cancelled"],
    ])("maps seller status %s to buyer status %s", (sellerStatus, buyerStatus) => {
      expect(sellerStatusToBuyerOrderStatus(sellerStatus)).toBe(buyerStatus);
    });

    it("returns null for unknown statuses", () => {
      expect(sellerStatusToBuyerOrderStatus("shipped")).toBeNull();
      expect(sellerStatusToBuyerOrderStatus("")).toBeNull();
      expect(sellerStatusToBuyerOrderStatus("COMPLETED")).toBeNull();
    });
  });

  describe("aggregateSellerStatuses (multi-seller checkout)", () => {
    it("returns null when there are no seller statuses", () => {
      expect(aggregateSellerStatuses([])).toBeNull();
    });

    it("is cancelled when every seller cancelled", () => {
      expect(aggregateSellerStatuses(["cancelled", "cancelled"])).toBe("cancelled");
    });

    it("is delivered only when every seller completed", () => {
      expect(aggregateSellerStatuses(["completed", "completed"])).toBe("delivered");
    });

    it("stays pending while all sellers are pending", () => {
      expect(aggregateSellerStatuses(["pending", "pending"])).toBe("pending");
    });

    it("shows ready as soon as any seller is ready or confirmed", () => {
      expect(aggregateSellerStatuses(["pending", "ready"])).toBe("ready");
      expect(aggregateSellerStatuses(["pending", "confirmed"])).toBe("ready");
    });

    it("normalises casing and missing values", () => {
      expect(aggregateSellerStatuses(["READY"])).toBe("ready");
      expect(aggregateSellerStatuses(["", "pending"])).toBe("pending");
    });

    it("falls back to the first seller's mapped status for mixed terminal states", () => {
      expect(aggregateSellerStatuses(["completed", "cancelled"])).toBe("delivered");
      expect(aggregateSellerStatuses(["cancelled", "pending"])).toBe("cancelled");
    });
  });
});
