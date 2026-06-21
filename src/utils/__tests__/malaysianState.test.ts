import {
  extractStateFromAddress,
  malaysianStatesMatch,
  normalizeMalaysianState,
  resolveStateFromGeocode,
} from "@/src/utils/malaysianState";

describe("malaysianState", () => {
  describe("normalizeMalaysianState", () => {
    it("normalizes Kuala Lumpur aliases", () => {
      expect(normalizeMalaysianState("Wilayah Persekutuan Kuala Lumpur")).toBe(
        "kuala lumpur",
      );
      expect(normalizeMalaysianState("KL")).toBe("kuala lumpur");
    });

    it("normalizes Penang aliases", () => {
      expect(normalizeMalaysianState("Pulau Pinang")).toBe("penang");
    });

    it("returns null for unrelated text", () => {
      expect(normalizeMalaysianState("George Town")).toBeNull();
    });
  });

  describe("extractStateFromAddress", () => {
    it("reads state from the end of a formatted address", () => {
      expect(
        extractStateFromAddress(
          "10 Jalan Ampang, Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, Malaysia",
        ),
      ).toBe("kuala lumpur");
      expect(
        extractStateFromAddress("12 Lebuh Pantai, George Town, Penang, Malaysia"),
      ).toBe("penang");
    });
  });

  describe("resolveStateFromGeocode", () => {
    it("prefers the region field", () => {
      expect(
        resolveStateFromGeocode({
          region: "Selangor",
          city: "Petaling Jaya",
        } as never),
      ).toBe("selangor");
    });
  });

  describe("malaysianStatesMatch", () => {
    it("matches identical states only", () => {
      expect(malaysianStatesMatch("kuala lumpur", "kuala lumpur")).toBe(true);
      expect(malaysianStatesMatch("kuala lumpur", "penang")).toBe(false);
      expect(malaysianStatesMatch(null, "penang")).toBe(false);
    });
  });
});
