/**
 * Integration performance tests.
 *
 * Metrics tested:
 *  1. Listing load time          — inventoryService.getInventory + active-feed filter
 *  2. Dashboard refresh speed    — getDashboardStats (orders + inventory aggregation)
 *  3. Image upload time          — uploadImageFromUri (blob fetch → Storage → download URL)
 *  4. AI prediction response time — predictForCafe / batchPredict / classifyFoodImage
 *
 * The real service-layer code runs end to end; only the network boundary
 * (Firestore, Firebase Storage, AI HTTP API) is replaced with mocks that
 * simulate realistic latency. This keeps timings reproducible in CI while
 * still measuring the full integration path (serialization, mapping,
 * aggregation, multi-call orchestration).
 */

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
    id: segments[segments.length - 1],
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("@/src/services/firebase/config", () => ({
  db: {},
  storage: {},
  auth: {},
}));

import { getDocs } from "firebase/firestore";
import { getDownloadURL, uploadBytes } from "firebase/storage";

import { getDashboardStats } from "@/src/services/firebase/analytics";
import {
  inventoryService,
  isActiveListing,
  InventoryItem,
} from "@/src/services/firebase/inventoryServices";
import { uploadImageFromUri } from "@/src/services/firebase/storageUpload";
import { batchPredict, classifyFoodImage, predictForCafe } from "@/src/ai/api";

jest.setTimeout(120_000);

// ─── Simulated network conditions (typical 4G / Wi-Fi) ─────────────────────

/** Firestore round-trip per query. */
const FIRESTORE_LATENCY_MS = { min: 60, max: 140 };
/** Reading the local image file into a blob. */
const LOCAL_FILE_READ_MS = { min: 10, max: 30 };
/** Fixed Storage handshake cost + per-KB upload throughput. */
const STORAGE_BASE_MS = { min: 120, max: 220 };
const UPLOAD_THROUGHPUT_KBPS = 900;
/** Download-URL token fetch. */
const DOWNLOAD_URL_MS = { min: 50, max: 110 };
/** AI backend inference times. */
const AI_PREDICT_MS = { min: 300, max: 600 };
const AI_BATCH_PREDICT_MS = { min: 500, max: 900 };
const AI_CLASSIFY_IMAGE_MS = { min: 700, max: 1300 };

const IMAGE_SIZE_KB = 350; // typical compressed listing photo

// ─── Acceptance thresholds (95th percentile must stay below these) ─────────

const THRESHOLDS_MS = {
  listingLoad: 2000,
  dashboardRefresh: 3000,
  imageUpload: 5000,
  aiPrediction: 8000,
};

const ITERATIONS = 5;

// ─── Measurement helpers ────────────────────────────────────────────────────

const nowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const randomBetween = (range: { min: number; max: number }): number =>
  range.min + Math.random() * (range.max - range.min);

const simulateLatency = (range: { min: number; max: number }): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, randomBetween(range)));

interface MetricResult {
  metric: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  thresholdMs: number;
  pass: boolean;
}

const results: MetricResult[] = [];

const round = (n: number): number => Math.round(n * 100) / 100;

/** Runs `fn` ITERATIONS times (plus one warm-up) and records timing stats. */
async function measure(
  metric: string,
  thresholdMs: number,
  fn: () => Promise<unknown>,
): Promise<MetricResult> {
  await fn(); // warm-up (module init, JIT) — not counted

  const durations: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = nowMs();
    await fn();
    durations.push(nowMs() - start);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const p95Index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );

  const result: MetricResult = {
    metric,
    iterations: ITERATIONS,
    avgMs: round(durations.reduce((s, d) => s + d, 0) / durations.length),
    minMs: round(sorted[0]),
    maxMs: round(sorted[sorted.length - 1]),
    p95Ms: round(sorted[p95Index]),
    thresholdMs,
    pass: sorted[p95Index] <= thresholdMs,
  };

  results.push(result);
  return result;
}

// ─── Fixture data ───────────────────────────────────────────────────────────

const SELLER_ID = "seller-perf-test";

const inFuture = (hours: number): Date =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

const fakeTimestamp = (date: Date) => ({ toDate: () => date });

const makeDocSnapshot = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

const makeQuerySnapshot = (
  docs: { id: string; data: () => Record<string, unknown> }[],
) => ({
  docs,
  size: docs.length,
  empty: docs.length === 0,
  forEach: (cb: (doc: (typeof docs)[number]) => void) => docs.forEach(cb),
});

/** 50 listings: mix of bags/items, some sold out, some near expiry. */
const inventoryDocs = Array.from({ length: 50 }, (_, i) =>
  makeDocSnapshot(`item-${i}`, {
    sellerId: SELLER_ID,
    name: `Listing ${i}`,
    type: i % 2 === 0 ? "bag" : "item",
    category: "Bakery",
    quantity: 10,
    sold: i % 10 === 0 ? 10 : i % 5, // every 10th listing is sold out
    price: 9.9,
    originalPrice: 25,
    discountedPrice: 9.9,
    smartPricingEnabled: true,
    expiryDate: "",
    expiryTime: fakeTimestamp(inFuture(i % 7 === 0 ? 3 : 24)),
    status: i % 7 === 0 ? "expiring" : "fresh",
    createdAt: fakeTimestamp(new Date()),
    updatedAt: fakeTimestamp(new Date()),
  }),
);

/** 20 orders spread over today/yesterday for the dashboard aggregation. */
const orderDocs = Array.from({ length: 20 }, (_, i) =>
  makeDocSnapshot(`order-${i}`, {
    total: 15 + i,
    quantity: 1 + (i % 3),
    status: "completed",
    createdAt: fakeTimestamp(new Date()),
  }),
);

const getDocsMock = getDocs as jest.Mock;
const uploadBytesMock = uploadBytes as jest.Mock;
const getDownloadURLMock = getDownloadURL as jest.Mock;

const installFirestoreMock = () => {
  getDocsMock.mockImplementation(async (ref: { path?: string }) => {
    await simulateLatency(FIRESTORE_LATENCY_MS);
    const path = ref?.path ?? "";
    if (path.includes("inventory")) return makeQuerySnapshot(inventoryDocs);
    return makeQuerySnapshot(orderDocs);
  });
};

const installStorageMock = () => {
  uploadBytesMock.mockImplementation(async (_ref, blob: { size: number }) => {
    const transferMs = ((blob.size / 1024) / UPLOAD_THROUGHPUT_KBPS) * 1000;
    await simulateLatency(STORAGE_BASE_MS);
    await new Promise((resolve) => setTimeout(resolve, transferMs));
    return { metadata: { size: blob.size } };
  });
  getDownloadURLMock.mockImplementation(async (ref: { fullPath: string }) => {
    await simulateLatency(DOWNLOAD_URL_MS);
    return `https://firebasestorage.test/${ref.fullPath}`;
  });
};

/** fetch mock covering local file reads (blob) and the AI HTTP API. */
const installFetchMock = () => {
  (global as any).fetch = jest.fn(async (url: string) => {
    const target = String(url);

    // Local image file read (file:// or content:// URI)
    if (target.startsWith("file:") || target.startsWith("content:")) {
      await simulateLatency(LOCAL_FILE_READ_MS);
      return {
        ok: true,
        status: 200,
        blob: async () => ({ size: IMAGE_SIZE_KB * 1024 }),
      };
    }

    // AI backend endpoints
    if (target.includes("/classify-food")) {
      await simulateLatency(AI_CLASSIFY_IMAGE_MS);
      return jsonResponse({
        foodLabel: "croissant",
        category: "Pastries",
        confidence: 0.91,
      });
    }
    if (target.includes("/batch-predict")) {
      await simulateLatency(AI_BATCH_PREDICT_MS);
      return jsonResponse({
        cafe_id: "cafe-1",
        cafe_name: "Perf Cafe",
        day: "Monday",
        date: "2026-06-15",
        predictions: [
          { item: "Croissant", predicted_sales: 24, recommended_production: 26, expected_surplus: 2 },
          { item: "Bagel", predicted_sales: 18, recommended_production: 20, expected_surplus: 2 },
        ],
        total_predicted_sales: 42,
        total_recommended_production: 46,
        total_expected_surplus: 4,
      });
    }
    if (target.includes("/predict")) {
      await simulateLatency(AI_PREDICT_MS);
      return jsonResponse({
        cafe_id: "cafe-1",
        cafe_name: "Perf Cafe",
        item: "Croissant",
        day_of_week: "Monday",
        predicted_sales: 24,
        recommended_production: 26,
        produced_qty: 26,
        expected_surplus: 2,
        surplus_rate: 0.08,
        price_rm: 4.5,
        revenue_rm: 108,
        is_weekend: false,
        model_accuracy: 0.87,
        cv_mae: 2.1,
        training_size: 365,
      });
    }

    throw new Error(`Unexpected fetch in perf test: ${target}`);
  });
};

const jsonResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

beforeEach(() => {
  installFirestoreMock();
  installStorageMock();
  installFetchMock();

  if (typeof (global as any).FormData === "undefined") {
    (global as any).FormData = class {
      private parts: [string, unknown][] = [];
      append(name: string, value: unknown) {
        this.parts.push([name, value]);
      }
    };
  }
});

// ─── 1. Listing load time ───────────────────────────────────────────────────

describe("Integration performance: listing load time", () => {
  it(`loads and filters 50 listings with p95 under ${THRESHOLDS_MS.listingLoad}ms`, async () => {
    let lastFeed: InventoryItem[] = [];

    const result = await measure(
      "Listing load time",
      THRESHOLDS_MS.listingLoad,
      async () => {
        const items = await inventoryService.getInventory(SELLER_ID);
        lastFeed = items.filter((item) => isActiveListing(item));
      },
    );

    // Integration correctness: full fetch + active-feed filtering happened
    expect(lastFeed.length).toBeGreaterThan(0);
    expect(lastFeed.length).toBeLessThan(50); // sold-out listings filtered out
    expect(result.pass).toBe(true);
    expect(result.p95Ms).toBeLessThanOrEqual(THRESHOLDS_MS.listingLoad);
  });
});

// ─── 2. Dashboard refresh speed ─────────────────────────────────────────────

describe("Integration performance: dashboard refresh speed", () => {
  it(`refreshes seller dashboard stats with p95 under ${THRESHOLDS_MS.dashboardRefresh}ms`, async () => {
    let lastStats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;

    const result = await measure(
      "Dashboard refresh speed",
      THRESHOLDS_MS.dashboardRefresh,
      async () => {
        lastStats = await getDashboardStats(SELLER_ID);
      },
    );

    // Aggregation across today's orders, yesterday's orders and inventory ran
    expect(lastStats).not.toBeNull();
    expect(lastStats!.todayRevenue).toBeGreaterThan(0);
    expect(lastStats!.bagsSoldToday).toBeGreaterThan(0);
    expect(result.pass).toBe(true);
    expect(result.p95Ms).toBeLessThanOrEqual(THRESHOLDS_MS.dashboardRefresh);
  });
});

// ─── 3. Image upload time ───────────────────────────────────────────────────

describe("Integration performance: image upload time", () => {
  it(`uploads a ${IMAGE_SIZE_KB}KB listing photo with p95 under ${THRESHOLDS_MS.imageUpload}ms`, async () => {
    let lastUrl = "";

    const result = await measure(
      "Image upload time",
      THRESHOLDS_MS.imageUpload,
      async () => {
        lastUrl = await uploadImageFromUri(
          "file:///data/user/0/app/cache/listing-photo.jpg",
          `sellers/${SELLER_ID}/inventory/listing-photo.jpg`,
        );
      },
    );

    // Full pipeline ran: blob fetch → uploadBytes → getDownloadURL
    expect(lastUrl).toContain("https://firebasestorage.test/");
    expect(uploadBytesMock).toHaveBeenCalled();
    expect(result.pass).toBe(true);
    expect(result.p95Ms).toBeLessThanOrEqual(THRESHOLDS_MS.imageUpload);
  });
});

// ─── 4. AI prediction response time ─────────────────────────────────────────

describe("Integration performance: AI prediction response time", () => {
  it(`single demand prediction responds with p95 under ${THRESHOLDS_MS.aiPrediction}ms`, async () => {
    let lastPrediction: Awaited<ReturnType<typeof predictForCafe>> | null =
      null;

    const result = await measure(
      "AI prediction (single item)",
      THRESHOLDS_MS.aiPrediction,
      async () => {
        lastPrediction = await predictForCafe({
          cafe_id: "cafe-1",
          item: "Croissant",
          day_of_week: "Monday",
        });
      },
    );

    expect(lastPrediction).not.toBeNull();
    expect(lastPrediction!.predicted_sales).toBeGreaterThan(0);
    expect(result.pass).toBe(true);
  });

  it(`batch demand prediction responds with p95 under ${THRESHOLDS_MS.aiPrediction}ms`, async () => {
    let lastBatch: Awaited<ReturnType<typeof batchPredict>> | null = null;

    const result = await measure(
      "AI prediction (batch)",
      THRESHOLDS_MS.aiPrediction,
      async () => {
        lastBatch = await batchPredict("cafe-1", "Monday");
      },
    );

    expect(lastBatch).not.toBeNull();
    expect(lastBatch!.predictions.length).toBeGreaterThan(0);
    expect(result.pass).toBe(true);
  });

  it(`AI food image classification responds with p95 under ${THRESHOLDS_MS.aiPrediction}ms`, async () => {
    let lastClassification: Awaited<
      ReturnType<typeof classifyFoodImage>
    > | null = null;

    const result = await measure(
      "AI prediction (image classification)",
      THRESHOLDS_MS.aiPrediction,
      async () => {
        lastClassification = await classifyFoodImage(
          "file:///data/user/0/app/cache/food.jpg",
        );
      },
    );

    expect(lastClassification).not.toBeNull();
    expect(lastClassification!.category).toBe("Pastries");
    expect(lastClassification!.confidence).toBeGreaterThan(0.5);
    expect(result.pass).toBe(true);
  });
});

// ─── Summary report ─────────────────────────────────────────────────────────

afterAll(() => {
  if (!results.length) return;

  const header =
    "\n================ INTEGRATION PERFORMANCE SUMMARY ================";
  const lines = results.map(
    (r) =>
      `${r.pass ? "PASS" : "FAIL"} | ${r.metric.padEnd(38)} | ` +
      `avg ${String(r.avgMs).padStart(8)}ms | ` +
      `min ${String(r.minMs).padStart(8)}ms | ` +
      `max ${String(r.maxMs).padStart(8)}ms | ` +
      `p95 ${String(r.p95Ms).padStart(8)}ms | ` +
      `threshold ${r.thresholdMs}ms`,
  );
  const footer =
    "==================================================================\n";

  // eslint-disable-next-line no-console
  console.log([header, ...lines, footer].join("\n"));
});
