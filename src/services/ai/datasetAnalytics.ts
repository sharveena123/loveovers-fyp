import { batchPredict, getCafeDataset, getCafeInfo } from "@/src/ai/api";
import {
  CafeInfo,
  DatasetAnalyticsBundle,
  DatasetRow,
  DayOfWeek,
  ItemForecast,
} from "@/src/ai/types";
import { db } from "@/src/services/firebase/config";
import { inventoryService } from "@/src/services/firebase/inventoryServices";
import { colors } from "@/src/theme/styles";
import { collection, getDocs } from "firebase/firestore";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night"] as const;

const CHART_COLORS = [
  colors.primary,
  colors.success,
  "#C4A77D",
  "#8B6914",
  colors.error,
  "#5D4037",
];

const num = (row: DatasetRow, keys: string[]): number => {
  for (const key of keys) {
    const v = row[key];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
};

const str = (row: DatasetRow, keys: string[]): string => {
  for (const key of keys) {
    const v = row[key];
    if (v !== null && v !== undefined && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
};

const parseDate = (raw: string): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const shortDay = (d: Date): string =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Distinct axis label per calendar day (avoids repeating "Mon" across weeks). */
const formatChartDateLabel = (dateKey: string): string => {
  const parsed = parseDate(dateKey);
  if (!parsed) return dateKey.slice(5);
  return `${shortDay(parsed)} ${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]}`;
};

const formatDateKey = (d: Date): string => d.toISOString().split("T")[0];

const normalizeDay = (value: string): string => {
  if (!value) return "Unknown";
  const lower = value.toLowerCase();
  const match = DAY_ORDER.find((d) => d.toLowerCase().startsWith(lower.slice(0, 3)));
  return match ?? value;
};

const timeSlotFromDate = (d: Date | null, sold: number): string => {
  if (!d) {
    const idx = Math.min(
      TIME_SLOTS.length - 1,
      Math.floor((sold % 17) / 5),
    );
    return TIME_SLOTS[idx];
  }
  const hour = d.getHours();
  if (hour < 11) return "Morning";
  if (hour < 15) return "Afternoon";
  if (hour < 19) return "Evening";
  return "Night";
};

const buildInsights = (
  bundle: Omit<DatasetAnalyticsBundle, "insights">,
): string[] => {
  const lines: string[] = [];
  const { kpis, wasteAnalysis, salesOverTime, modelAccuracy } = bundle;

  if (modelAccuracy > 0) {
    lines.push(
      `Your sales file has ${bundle.trainingRows.toLocaleString()} rows. Suggestions are about ${(modelAccuracy * 100).toFixed(0)}% reliable based on past patterns.`,
    );
  } else {
    lines.push(
      `We are using ${bundle.trainingRows.toLocaleString()} sales rows from your shop history.`,
    );
  }

  if (kpis.topProduct !== "N/A") {
    lines.push(
      `${kpis.topProduct} is your best seller — bake more of this on busy days.`,
    );
  }

  const highWaste = wasteAnalysis
    .filter((w) => w.wastePercentage > 25)
    .slice(0, 2);
  highWaste.forEach((w) => {
    lines.push(
      `${w.itemName} often gets left over (${w.wastePercentage.toFixed(0)}% waste) — try baking less or listing mystery bags.`,
    );
  });

  if (salesOverTime.length >= 2) {
    const last = salesOverTime[salesOverTime.length - 1];
    const prev = salesOverTime[salesOverTime.length - 2];
    const delta =
      prev.sales > 0 ? ((last.sales - prev.sales) / prev.sales) * 100 : 0;
    lines.push(
      `Latest day earnings were ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% compared with the day before.`,
    );
  }

  if (kpis.wastePercentage > 20) {
    lines.push(
      `About ${kpis.wastePercentage.toFixed(1)}% of what you make goes unsold. Check bake suggestions before each batch.`,
    );
  } else {
    lines.push(
      `Only ${kpis.wastePercentage.toFixed(1)}% waste — you are doing well. Keep matching bake amounts to expected sales.`,
    );
  }

  return lines.slice(0, 6);
};

async function buildRecordsFromFirebase(
  sellerId: string,
): Promise<DatasetRow[]> {
  const records: DatasetRow[] = [];
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  try {
    const items = await inventoryService.getInventory(sellerId);
    items.forEach((item) => {
      const produced = item.quantity || 0;
      const sold = item.sold || 0;
      if (produced === 0 && sold === 0) return;

      const created =
        item.createdAt && typeof item.createdAt.toDate === "function"
          ? item.createdAt.toDate()
          : new Date();
      records.push({
        item: item.name,
        sold_qty: sold,
        produced_qty: Math.max(produced, sold),
        price: item.price || 8,
        date: created.toISOString().split("T")[0],
        day_of_week: dayNames[created.getDay()],
      });
    });
  } catch (e) {
    console.warn("Inventory fallback failed:", e);
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const ordersRef = collection(db, "sellers", sellerId, "orders");
    // Fetch all orders (no composite index) and filter by date client-side.
    const snap = await getDocs(ordersRef);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const created = data.createdAt?.toDate?.() ?? new Date();
      if (created < since) return;
      const dateKey = created.toISOString().split("T")[0];

      if (Array.isArray(data.items)) {
        data.items.forEach((it: { name?: string; quantity?: number; price?: number }) => {
          const qty = it.quantity || 1;
          records.push({
            item: it.name || "Order item",
            sold_qty: qty,
            produced_qty: qty,
            price: it.price || 8,
            date: dateKey,
            day_of_week: dayNames[created.getDay()],
          });
        });
      } else {
        const qty = data.quantity || 1;
        const total = data.total ?? data.totalPrice ?? qty * 8;
        records.push({
          item: "Store order",
          sold_qty: qty,
          produced_qty: qty,
          price: total / qty,
          date: dateKey,
          day_of_week: dayNames[created.getDay()],
        });
      }
    });
  } catch (e) {
    console.warn("Orders fallback failed:", e);
  }

  return records;
}

export async function loadDatasetAnalytics(
  cafeId: string,
  sellerId?: string,
): Promise<DatasetAnalyticsBundle | null> {
  const [cafeInfo, dataset] = await Promise.all([
    getCafeInfo(cafeId).catch(() => null),
    getCafeDataset(cafeId),
  ]);

  let records = dataset?.records ?? [];
  let dataSource: "dataset" | "firebase" = "dataset";

  if (!records.length && sellerId) {
    records = await buildRecordsFromFirebase(sellerId);
    dataSource = "firebase";
  }

  if (!records.length) return null;

  const bundle = buildAnalyticsFromRecords(
    records,
    cafeInfo ?? {
      cafe_id: cafeId,
      cafe_name: dataset?.cafe_name ?? "Your café",
      items: [],
      training_rows: cafeInfo?.training_rows ?? records.length,
      r2: dataset?.summary?.r2 ?? cafeInfo?.r2 ?? 0,
      cv_mae: cafeInfo?.cv_mae ?? 0,
      model: cafeInfo?.model ?? "ensemble",
    },
    dataSource,
  );

  try {
    const today = new Date();
    const dayName = DAY_ORDER[today.getDay() === 0 ? 6 : today.getDay() - 1];
    const batch = await batchPredict(cafeId, dayName as DayOfWeek);
    if (batch.predictions?.length) {
      const forecasts: ItemForecast[] = batch.predictions
        .slice(0, 8)
        .map((p) => ({
          item: p.item,
          predicted: p.predicted_sales,
          recommended: p.recommended_production,
        }));
      bundle.itemForecasts = forecasts;
      bundle.insights = [
        `Today's AI batch forecast: ${batch.total_predicted_sales} units across ${batch.predictions.length} items.`,
        ...bundle.insights,
      ].slice(0, 6);
    }
  } catch {
    // batch predict optional
  }

  return bundle;
}

/** Live-store analytics when no AI cafe is linked yet. */
export async function loadFirebaseOnlyAnalytics(
  sellerId: string,
  businessName: string,
): Promise<DatasetAnalyticsBundle | null> {
  const records = await buildRecordsFromFirebase(sellerId);
  if (!records.length) return null;

  return buildAnalyticsFromRecords(
    records,
    {
      cafe_id: "live",
      cafe_name: businessName,
      items: [],
      training_rows: records.length,
      r2: 0,
      cv_mae: 0,
      model: "live",
    },
    "firebase",
  );
}

export function buildAnalyticsFromRecords(
  records: DatasetRow[],
  cafeInfo: CafeInfo,
  dataSource: "dataset" | "firebase" = "dataset",
): DatasetAnalyticsBundle {
  const byDate = new Map<
    string,
    { sales: number; sold: number; waste: number; orders: number }
  >();
  const byItem = new Map<
    string,
    { sold: number; waste: number; produced: number; revenue: number }
  >();
  const heatmapMap = new Map<string, number>();
  let totalSold = 0;
  let totalProduced = 0;
  let totalRevenue = 0;
  let minDate = "";
  let maxDate = "";

  const dailyActual: { date: string; sold: number }[] = [];
  const dailyPredicted: Map<string, number> = new Map();

  records.forEach((row) => {
    const item = str(row, ["item", "Item", "product", "product_name"]) || "Unknown";
    const sold = num(row, ["sold_qty", "sold", "quantity_sold"]);
    const produced = num(row, ["produced_qty", "produced", "quantity_produced"]);
    const price = num(row, ["price", "price_rm", "unit_price"]) || 8;
    const predicted = num(row, [
      "predicted_sales",
      "predicted_qty",
      "forecast",
      "base_predicted_sales",
    ]);
    const waste = Math.max(0, produced - sold);
    const revenue = sold * price;

    totalSold += sold;
    totalProduced += produced || sold + waste;
    totalRevenue += revenue;

    const itemRow = byItem.get(item) ?? {
      sold: 0,
      waste: 0,
      produced: 0,
      revenue: 0,
    };
    itemRow.sold += sold;
    itemRow.waste += waste;
    itemRow.produced += produced || sold + waste;
    itemRow.revenue += revenue;
    byItem.set(item, itemRow);

    const dateRaw = str(row, ["date", "Date", "sale_date"]);
    const parsed = parseDate(dateRaw);
    const dateKey = parsed ? formatDateKey(parsed) : dateRaw || "unknown";
    if (parsed) {
      if (!minDate || dateKey < minDate) minDate = dateKey;
      if (!maxDate || dateKey > maxDate) maxDate = dateKey;
    }

    const dayBucket = byDate.get(dateKey) ?? {
      sales: 0,
      sold: 0,
      waste: 0,
      orders: 0,
    };
    dayBucket.sales += revenue;
    dayBucket.sold += sold;
    dayBucket.waste += waste;
    dayBucket.orders += sold > 0 ? 1 : 0;
    byDate.set(dateKey, dayBucket);

    if (parsed && sold > 0) {
      dailyActual.push({ date: dateKey, sold });
    }

    const dayFull = parsed
      ? shortDay(parsed)
      : normalizeDay(str(row, ["day_of_week", "day", "weekday"]));
    const dayLabel = dayFull.length > 3 ? dayFull.slice(0, 3) : dayFull;
    const slot = timeSlotFromDate(parsed, sold);
    const heatKey = `${dayLabel}|${slot}`;
    heatmapMap.set(heatKey, (heatmapMap.get(heatKey) ?? 0) + (sold > 0 ? 1 : 0));

    if (predicted > 0 && dateKey !== "unknown") {
      dailyPredicted.set(
        dateKey,
        (dailyPredicted.get(dateKey) ?? 0) + predicted,
      );
    }
  });

  // Rolling average as predicted baseline when column missing
  const sortedDates = [...byDate.keys()].filter((d) => d !== "unknown").sort();
  sortedDates.forEach((dateKey, idx) => {
    if (dailyPredicted.has(dateKey)) return;
    const window = sortedDates.slice(Math.max(0, idx - 6), idx + 1);
    const avg =
      window.reduce((sum, d) => sum + (byDate.get(d)?.sold ?? 0), 0) /
      Math.max(1, window.length);
    dailyPredicted.set(dateKey, Math.round(avg));
  });

  const chartDateKeys = sortedDates.slice(-14);

  const salesOverTime = chartDateKeys.map((dateKey) => {
    const d = byDate.get(dateKey)!;
    return {
      label: formatChartDateLabel(dateKey),
      date: dateKey,
      sales: Math.round(d.sales),
      orders: d.orders,
      sold: d.sold,
      waste: d.waste,
    };
  });

  const itemRows = [...byItem.entries()]
    .map(([itemName, v]) => {
      const produced = v.produced || v.sold + v.waste;
      return {
        itemName,
        sold: v.sold,
        waste: v.waste,
        produced,
        wastePercentage: produced > 0 ? (v.waste / produced) * 100 : 0,
        revenue: Math.round(v.revenue),
      };
    })
    .sort((a, b) => b.sold - a.sold);

  const topSellingItems = itemRows.slice(0, 8);
  const wasteAnalysis = [...itemRows].sort((a, b) => b.waste - a.waste).slice(0, 8);

  const revenueByCategory = topSellingItems.slice(0, 5).map((item, i) => ({
    label: item.itemName.length > 12 ? `${item.itemName.slice(0, 10)}…` : item.itemName,
    value: item.revenue,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const actualVsPredicted = chartDateKeys.map((dateKey) => {
    const actual = byDate.get(dateKey)?.sold ?? 0;
    const predicted = dailyPredicted.get(dateKey) ?? actual;
    return {
      label: formatChartDateLabel(dateKey),
      date: dateKey,
      actual: Math.round(actual),
      predicted: Math.round(predicted),
    };
  });

  const surplusTrend = salesOverTime.map((d) => ({
    label: d.label,
    date: d.date,
    surplus: d.waste,
    sold: d.sold,
  }));

  const scatterData = itemRows.slice(0, 12).map((item) => ({
    item: item.itemName,
    prepared: item.produced,
    sold: item.sold,
  }));

  const heatDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmap = heatDays.flatMap((day) =>
    TIME_SLOTS.map((time) => ({
      day,
      time,
      orders: heatmapMap.get(`${day}|${time}`) ?? 0,
    })),
  );

  const totalWaste = Math.max(0, totalProduced - totalSold);
  const wastePct =
    totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0;
  const conversionRate =
    totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;

  const funnel = [
    { stage: "Prepared", count: Math.round(totalProduced), color: colors.primary },
    {
      stage: "Listed",
      count: Math.round(totalProduced * 0.92),
      color: "#8B6914",
    },
    { stage: "Sold", count: Math.round(totalSold), color: colors.success },
    {
      stage: "Repeat buyers",
      count: Math.round(totalSold * 0.35),
      color: "#C4A77D",
    },
  ];

  const partial: Omit<DatasetAnalyticsBundle, "insights"> = {
    cafeId: cafeInfo.cafe_id,
    cafeName: cafeInfo.cafe_name,
    dataSource,
    trainingRows: cafeInfo.training_rows || records.length,
    modelAccuracy: cafeInfo.r2 ?? 0,
    dateRange: {
      start: minDate || "—",
      end: maxDate || "—",
    },
    kpis: {
      totalSales: Math.round(totalRevenue),
      itemsSold: Math.round(totalSold),
      wastePercentage: Math.round(wastePct * 10) / 10,
      revenueSaved: Math.round(totalWaste * 8),
      topProduct: topSellingItems[0]?.itemName ?? "N/A",
      conversionRate: Math.round(conversionRate * 10) / 10,
      averageOrderValue:
        totalSold > 0 ? Math.round(totalRevenue / totalSold) : 0,
    },
    salesOverTime,
    topSellingItems,
    wasteAnalysis,
    revenueByCategory,
    actualVsPredicted,
    surplusTrend,
    scatterData,
    heatmap,
    funnel,
    insights: [],
  };

  return {
    ...partial,
    insights: buildInsights(partial),
  };
}
