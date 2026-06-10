import type { InventoryItem } from "@/src/services/firebase/inventoryServices";

/** Deterministic A/B bucket for markdown aggressiveness (0 = stable, 1 = boost). */
export function abVariantFromListingId(listingId: string, sellerId: string): 0 | 1 {
  let h = 0;
  const s = `${sellerId}:${listingId}`;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 2 === 0 ? 0 : 1;
}

function timestampToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const seconds = (value as { seconds?: number }).seconds;
  if (typeof seconds === "number") {
    const d = new Date(seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseTimeOnDate(base: Date, timeRaw: string): Date {
  const t = timeRaw.trim();
  const ap = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ap) {
    let hh = parseInt(ap[1], 10);
    const mm = parseInt(ap[2], 10);
    if (ap[3].toUpperCase() === "PM" && hh < 12) hh += 12;
    if (ap[3].toUpperCase() === "AM" && hh === 12) hh = 0;
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hh,
      mm,
      0,
      0,
    );
  }
  const hm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      parseInt(hm[1], 10),
      parseInt(hm[2], 10),
      hm[3] ? parseInt(hm[3], 10) : 0,
      0,
    );
  }
  return base;
}

function parseDateOnlyLocal(
  year: number,
  month: number,
  day: number,
  endOfDay: boolean,
): Date {
  if (endOfDay) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function resolveExpiryDate(item: InventoryItem): Date | null {
  const fromTimestamp = timestampToDate(item.expiryTime);
  if (fromTimestamp) return fromTimestamp;

  const raw = item.expiryDate?.trim();
  if (!raw) return null;

  if (raw.includes(",")) {
    const [datePart, timePart] = raw.split(",").map((x) => x.trim());
    const base = resolveExpiryDate({
      ...item,
      expiryDate: datePart,
      expiryTime: undefined,
    });
    if (!base) return null;
    return parseTimeOnDate(base, timePart);
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return parseDateOnlyLocal(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10),
      parseInt(iso[3], 10),
      true,
    );
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return parseDateOnlyLocal(
      parseInt(slash[3], 10),
      parseInt(slash[2], 10),
      parseInt(slash[1], 10),
      true,
    );
  }

  const isoDateTime = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/,
  );
  if (isoDateTime) {
    return new Date(
      parseInt(isoDateTime[1], 10),
      parseInt(isoDateTime[2], 10) - 1,
      parseInt(isoDateTime[3], 10),
      parseInt(isoDateTime[4], 10),
      parseInt(isoDateTime[5], 10),
      0,
      0,
    );
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when the listing is past its resolved expiry instant. */
export function isListingExpired(
  item: InventoryItem,
  now: Date = new Date(),
): boolean {
  const expiry = resolveExpiryDate(item);
  if (!expiry) return false;
  return expiry.getTime() <= now.getTime();
}

export function hoursUntil(expiry: Date, now: Date): number {
  return (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Extra markdown % on top of the seller's listed sale floor (not off retail). */
export function computeExtraMarkdownPct(input: {
  hoursToExpiry: number;
  remainingFraction: number;
  hourOfDay: number;
  closingHour: number;
  abVariant: 0 | 1;
}): {
  extraMarkdownPct: number;
  expiryUrgency: number;
  stockPressure: number;
  closingWindow: number;
  abBoost: number;
} {
  const { hoursToExpiry, remainingFraction, hourOfDay, closingHour, abVariant } =
    input;

  let expiryUrgency = 0;
  if (hoursToExpiry <= 0) expiryUrgency = 45;
  else if (hoursToExpiry <= 2) expiryUrgency = 28;
  else if (hoursToExpiry <= 6) expiryUrgency = 18;
  else if (hoursToExpiry <= 24) expiryUrgency = 12;
  else if (hoursToExpiry <= 72) expiryUrgency = 7;
  else if (hoursToExpiry <= 168) expiryUrgency = 3;

  let stockPressure = 0;
  if (remainingFraction >= 0.85) stockPressure = 12;
  else if (remainingFraction >= 0.65) stockPressure = 8;
  else if (remainingFraction >= 0.45) stockPressure = 4;
  else if (remainingFraction >= 0.25) stockPressure = 2;

  const windowStart = closingHour - 3;
  let closingWindow = 0;
  if (hourOfDay >= closingHour) closingWindow = 18;
  else if (hourOfDay >= windowStart) {
    const t = (hourOfDay - windowStart) / Math.max(1, closingHour - windowStart);
    closingWindow = 6 + t * 12;
  }

  const abBoost = abVariant === 1 ? 5 : 0;

  const raw =
    expiryUrgency * 1.0 + stockPressure * 0.85 + closingWindow * 0.9 + abBoost;
  const extraMarkdownPct = clamp(Math.round(raw * 10) / 10, 0, 52);

  return {
    extraMarkdownPct,
    expiryUrgency,
    stockPressure,
    closingWindow,
    abBoost,
  };
}

/** Original retail for discount display; handles legacy docs missing originalPrice. */
export function resolveListingRetail(
  item: Pick<InventoryItem, "price" | "originalPrice" | "discountedPrice">,
  listFloor: number,
): number {
  if (item.originalPrice != null && item.originalPrice > listFloor) {
    return item.originalPrice;
  }
  const rawPrice = item.price ?? listFloor;
  if (rawPrice > listFloor + 0.004) {
    return rawPrice;
  }
  return Math.max(listFloor * 1.15, listFloor + 0.5);
}

export function isSmartPricingEnabled(item: InventoryItem): boolean {
  if (item.smartPricingEnabled === false) return false;
  if (item.type === "bag") return item.smartPricingEnabled !== false;
  return item.smartPricingEnabled === true;
}

export type LivePriceResult = {
  price: number;
  discountedPrice: number;
  originalPrice: number;
  smartLiveMarkdownPct: number;
  smartAbVariant: "A" | "B";
  smartPricingApplied: boolean;
};

/**
 * Applies demand + expiry + closing-time markdown on top of the seller's list price floor.
 * Buyers see `discountedPrice` / `price` as the live amount.
 */
export function computeLiveListingPrice(
  item: InventoryItem,
  options: {
    now: Date;
    closingHour: number;
    listingId: string;
    sellerId: string;
  },
): LivePriceResult {
  const listFloor = item.discountedPrice ?? item.price;
  const retail = resolveListingRetail(item, listFloor);
  const ab = abVariantFromListingId(options.listingId, options.sellerId);
  const expiry = resolveExpiryDate(item);
  const hoursToExpiry = expiry
    ? hoursUntil(expiry, options.now)
    : 168;
  const qty = Math.max(1, item.quantity || 1);
  const sold = Math.min(item.sold ?? 0, qty);
  const remaining = Math.max(0, qty - sold);
  const remainingFraction = remaining / qty;

  if (!isSmartPricingEnabled(item)) {
    return {
      price: listFloor,
      discountedPrice: listFloor,
      originalPrice: retail,
      smartLiveMarkdownPct: 0,
      smartAbVariant: ab === 0 ? "A" : "B",
      smartPricingApplied: false,
    };
  }

  const hourOfDay = options.now.getHours();
  const { extraMarkdownPct } = computeExtraMarkdownPct({
    hoursToExpiry,
    remainingFraction,
    hourOfDay,
    closingHour: clamp(options.closingHour, 12, 23),
    abVariant: ab,
  });

  const factor = 1 - extraMarkdownPct / 100;
  let live = Math.round(listFloor * factor * 100) / 100;

  const minPrice = Math.max(0.5, Math.round(retail * 0.28 * 100) / 100);
  live = clamp(live, minPrice, Math.max(listFloor, retail * 0.999));

  return {
    price: live,
    discountedPrice: live,
    originalPrice: retail,
    smartLiveMarkdownPct: extraMarkdownPct,
    smartAbVariant: ab === 0 ? "A" : "B",
    smartPricingApplied: true,
  };
}

/** First publish anchor when seller only sets retail (smart bag flow). */
export function computeInitialListingAnchor(
  retail: number,
  hoursToExpiry: number,
): number {
  const urgent =
    hoursToExpiry <= 24 ? 0.12 : hoursToExpiry <= 72 ? 0.08 : 0.04;
  const off = clamp(0.22 + urgent, 0.15, 0.45);
  return Math.round(retail * (1 - off) * 100) / 100;
}

/** Suggested % off retail for prediction / daily-sales simulator (no manual slider). */
export function suggestedSimulatorDiscountPct(now: Date, closingHour = 20): number {
  const h = now.getHours();
  const windowStart = closingHour - 2;
  if (h >= closingHour) return 22;
  if (h >= windowStart) return 12 + Math.round((h - windowStart) * 5);
  if (h >= 12) return 8;
  return 5;
}
