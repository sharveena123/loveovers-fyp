import { resolveBuyerPriceDisplay } from "@/src/utils/listingPrices";

describe("resolveBuyerPriceDisplay", () => {
  it("computes discount off retail, not list floor", () => {
    const result = resolveBuyerPriceDisplay({
      listFloorPrice: 10,
      price: 5,
      discountedPrice: 5,
      originalPrice: 15,
    });

    expect(result.salePrice).toBe(5);
    expect(result.compareAtPrice).toBe(15);
    expect(result.discountPct).toBe(67);
  });

  it("does not treat list floor as retail when live price drops below it", () => {
    const result = resolveBuyerPriceDisplay({
      listFloorPrice: 8,
      price: 5,
      discountedPrice: 5,
      originalPrice: 15,
    });

    expect(result.compareAtPrice).toBe(15);
    expect(result.discountPct).toBe(67);
  });

  it("uses legacy retail estimate when originalPrice is missing", () => {
    const result = resolveBuyerPriceDisplay({
      listFloorPrice: 8,
      price: 5,
      discountedPrice: 5,
    });

    expect(result.compareAtPrice).toBe(9.2);
    expect(result.discountPct).toBe(46);
  });

  it("returns zero discount when sale equals retail", () => {
    const result = resolveBuyerPriceDisplay({
      listFloorPrice: 8,
      price: 10,
      discountedPrice: 10,
      originalPrice: 10,
    });

    expect(result.discountPct).toBe(0);
    expect(result.compareAtPrice).toBeNull();
  });
});
