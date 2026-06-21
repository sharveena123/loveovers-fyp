import {
    collection,
    getDocs,
    query,
    Timestamp,
    where,
} from "firebase/firestore";
import { db } from "./config";

export interface DashboardStats {
  todayRevenue: number;
  bagsSoldToday: number;
  wasteReduction: number;
  itemsExpiring: number;
  revenueChange: number;
  bagsChange: number;
  wasteChange: number;
}

export interface SalesData {
  day: string;
  sales: number;
  waste: number;
}

export interface TopSellingItem {
  itemName: string;
  itemsSold: number;
  revenue: number;
  waste: number;
  totalProduced: number;
}

export interface WasteData {
  itemName: string;
  sold: number;
  waste: number;
  wastePercentage: number;
}

export interface AIInsightData {
  date: string;
  actual: number;
  predicted: number;
}

export interface CustomerActivityData {
  time: string;
  day: string;
  orders: number;
}

export interface RevenueData {
  period: string;
  revenue: number;
  category?: string;
}

export interface KPIMetrics {
  totalSales: number;
  itemsSold: number;
  wastePercentage: number;
  revenueSaved: number;
  topProduct: string;
  conversionRate: number;
  averageOrderValue: number;
}

export const getDashboardStats = async (
  sellerId: string,
): Promise<DashboardStats> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // One pass over all orders: today/yesterday revenue + units sold per listing.
    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const ordersSnapshot = await getDocs(ordersRef);

    let todayRevenue = 0;
    let bagsSoldToday = 0;
    let yesterdayRevenue = 0;
    let yesterdayBags = 0;
    /** Inventory listing id -> units sold across non-cancelled orders. */
    const soldByListingId = new Map<string, number>();

    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (String(data.status || "pending") === "cancelled") return;

      const items = (data.items || []) as Array<{
        id?: string;
        quantity?: number;
      }>;
      let orderUnits = 0;
      for (const item of items) {
        const qty = item.quantity || 1;
        orderUnits += qty;
        if (item.id) {
          soldByListingId.set(item.id, (soldByListingId.get(item.id) || 0) + qty);
        }
      }
      if (orderUnits === 0) orderUnits = 1;

      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate()
          : null;
      if (!createdAt) return;

      if (createdAt >= today) {
        todayRevenue += data.total || 0;
        bagsSoldToday += orderUnits;
      } else if (createdAt >= yesterday) {
        yesterdayRevenue += data.total || 0;
        yesterdayBags += orderUnits;
      }
    });

    // Calculate percentage changes
    const revenueChange =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    const bagsChange =
      yesterdayBags > 0
        ? ((bagsSoldToday - yesterdayBags) / yesterdayBags) * 100
        : 0;

    // Get inventory for expiring items and waste calculation
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");
    const inventorySnapshot = await getDocs(inventoryRef);

    let itemsExpiring = 0;
    let totalListed = 0;
    let totalSold = 0;

    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

    inventorySnapshot.forEach((doc) => {
      const data = doc.data();

      // Count expiring items
      if (data.expiryTime) {
        const expiryDate = data.expiryTime.toDate();
        if (expiryDate <= twoHoursFromNow && expiryDate > new Date()) {
          itemsExpiring++;
        }
      }

      // Waste reduced = % of listed stock rescued across all listings.
      // Use order line items only — the inventory `sold` counter can drift
      // (e.g. cancelled orders, deleted orders, or test checkouts).
      const listed = data.quantity || 0;
      const soldFromOrders = soldByListingId.get(doc.id) || 0;
      const sold = Math.min(listed, soldFromOrders);
      totalListed += listed;
      totalSold += sold;
    });

    const wasteReduction =
      totalListed > 0 ? Math.round((totalSold / totalListed) * 100) : 0;

    // Day-over-day change in units sold (operational trend for the badge).
    const wasteChange =
      yesterdayBags > 0
        ? ((bagsSoldToday - yesterdayBags) / yesterdayBags) * 100
        : 0;

    return {
      todayRevenue,
      bagsSoldToday,
      wasteReduction,
      itemsExpiring,
      revenueChange,
      bagsChange,
      wasteChange,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      todayRevenue: 0,
      bagsSoldToday: 0,
      wasteReduction: 0,
      itemsExpiring: 0,
      revenueChange: 0,
      bagsChange: 0,
      wasteChange: 0,
    };
  }
};

export const getWeeklySalesData = async (
  sellerId: string,
): Promise<SalesData[]> => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data: SalesData[] = [];

  try {
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const ordersRef = collection(db, "sellers", sellerId, "orders");
      const dayQuery = query(
        ordersRef,
        where("createdAt", ">=", Timestamp.fromDate(date)),
        where("createdAt", "<", Timestamp.fromDate(nextDay)),
      );

      const snapshot = await getDocs(dayQuery);
      let sales = 0;

      snapshot.forEach((doc) => {
        sales += doc.data().total || 0;
      });

      const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
      data.push({
        day: days[dayIndex],
        sales,
        waste: Math.floor(sales * 0.15),
      });
    }

    return data;
  } catch (error) {
    console.error("Error fetching weekly sales:", error);
    // Return mock data if error
    return days.map((day) => ({
      day,
      sales: 0,
      waste: 0,
    }));
  }
};

export const getTopSellingItems = async (
  sellerId: string,
): Promise<TopSellingItem[]> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const query_ = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
    );

    const snapshot = await getDocs(query_);
    const itemsMap: Map<string, TopSellingItem> = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          const itemName = item.name || "Unknown";
          const existing = itemsMap.get(itemName) || {
            itemName,
            itemsSold: 0,
            revenue: 0,
            waste: 0,
            totalProduced: 0,
          };

          existing.itemsSold += item.quantity || 1;
          existing.revenue += item.price * (item.quantity || 1);
          existing.totalProduced += item.quantity || 1;

          itemsMap.set(itemName, existing);
        });
      }
    });

    return Array.from(itemsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  } catch (error) {
    console.error("Error fetching top selling items:", error);
    return [];
  }
};

export const getWasteAnalysis = async (
  sellerId: string,
): Promise<WasteData[]> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get sold items from orders
    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const ordersQuery = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
    );

    const ordersSnapshot = await getDocs(ordersQuery);
    const soldItems: Map<string, number> = new Map();

    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          const itemName = item.name || "Unknown";
          const current = soldItems.get(itemName) || 0;
          soldItems.set(itemName, current + (item.quantity || 1));
        });
      }
    });

    // Get inventory for waste tracking
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");
    const inventorySnapshot = await getDocs(inventoryRef);
    const wasteData: WasteData[] = [];

    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      const itemName = data.itemName || "Unknown";
      const waste = data.wasteCount || 0;
      const sold = soldItems.get(itemName) || 0;
      const total = sold + waste;

      if (total > 0) {
        wasteData.push({
          itemName,
          sold,
          waste,
          wastePercentage: (waste / total) * 100,
        });
      }
    });

    return wasteData.sort((a, b) => b.waste - a.waste);
  } catch (error) {
    console.error("Error fetching waste analysis:", error);
    return [];
  }
};

export const getAIPredictionData = async (
  sellerId: string,
): Promise<AIInsightData[]> => {
  try {
    // Get last 30 days of actual data
    const data: AIInsightData[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const ordersRef = collection(db, "sellers", sellerId, "orders");
      const dayQuery = query(
        ordersRef,
        where("createdAt", ">=", Timestamp.fromDate(date)),
        where("createdAt", "<", Timestamp.fromDate(nextDay)),
      );

      const snapshot = await getDocs(dayQuery);
      let actual = 0;

      snapshot.forEach((doc) => {
        const items = doc.data().items || [];
        actual += items.reduce(
          (sum: number, item: any) => sum + (item.quantity || 1),
          0,
        );
      });

      // AI prediction is +10-15% of actual for demonstration
      const predicted = actual * (1 + Math.random() * 0.15);

      data.push({
        date: `${date.getDate()}/${date.getMonth() + 1}`,
        actual: Math.round(actual),
        predicted: Math.round(predicted),
      });
    }

    return data;
  } catch (error) {
    console.error("Error fetching AI prediction data:", error);
    return [];
  }
};

export const getCustomerActivity = async (
  sellerId: string,
): Promise<CustomerActivityData[]> => {
  try {
    const seventhDaysAgo = new Date();
    seventhDaysAgo.setDate(seventhDaysAgo.getDate() - 7);

    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const query_ = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(seventhDaysAgo)),
    );

    const snapshot = await getDocs(query_);
    const activityMap: Map<string, number> = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.createdAt) {
        const orderDate = data.createdAt.toDate();
        const hours = orderDate.getHours();
        const timeSlot = `${hours.toString().padStart(2, "0")}:00`;
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          orderDate.getDay()
        ];
        const key = `${dayName}-${timeSlot}`;

        const current = activityMap.get(key) || 0;
        activityMap.set(key, current + 1);
      }
    });

    return Array.from(activityMap.entries())
      .map(([key, orders]) => {
        const [day, time] = key.split("-");
        return { day: day as string, time, orders };
      })
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15);
  } catch (error) {
    console.error("Error fetching customer activity:", error);
    return [];
  }
};

export const getRevenueBreakdown = async (
  sellerId: string,
): Promise<RevenueData[]> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const query_ = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
    );

    const snapshot = await getDocs(query_);
    const revenueByCategory: Map<string, number> = new Map();
    let totalRegularSales = 0;
    let totalMysterySales = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const amount = data.total || 0;
      const isMystery = data.isMysteryBag || false;

      if (isMystery) {
        totalMysterySales += amount;
      } else {
        totalRegularSales += amount;
      }

      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          const category = item.category || "Other";
          const itemRevenue = item.price * (item.quantity || 1);
          const current = revenueByCategory.get(category) || 0;
          revenueByCategory.get(category)
            ? revenueByCategory.set(category, current + itemRevenue)
            : revenueByCategory.set(category, itemRevenue);
        });
      }
    });

    const breakdown: RevenueData[] = [
      { period: "Regular Bags", revenue: totalRegularSales },
      { period: "Mystery Bags", revenue: totalMysterySales },
    ];

    return breakdown;
  } catch (error) {
    console.error("Error fetching revenue breakdown:", error);
    return [];
  }
};

export const getKPIMetrics = async (sellerId: string): Promise<KPIMetrics> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersRef = collection(db, "sellers", sellerId, "orders");
    const query_ = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
    );

    const snapshot = await getDocs(query_);
    let totalSales = 0;
    let itemsSold = 0;
    let orderCount = 0;
    const itemRevenue: Map<string, number> = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalSales += data.total || 0;
      orderCount += 1;

      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          itemsSold += item.quantity || 1;
          const itemName = item.name || "Unknown";
          const revenue = item.price * (item.quantity || 1);
          const current = itemRevenue.get(itemName) || 0;
          itemRevenue.set(itemName, current + revenue);
        });
      }
    });

    // Get waste data
    const inventoryRef = collection(db, "sellers", sellerId, "inventory");
    const inventorySnapshot = await getDocs(inventoryRef);
    let totalWaste = 0;
    let totalProduced = 0;

    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      const waste = data.wasteCount || 0;
      totalWaste += waste;
      totalProduced += waste + (data.quantitySold || 0);
    });

    const wastePercentage =
      totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0;
    const revenueSaved =
      wastePercentage > 0 ? totalSales * (wastePercentage / 100) : 0;
    const topProduct =
      Array.from(itemRevenue.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "N/A";
    const conversionRate =
      orderCount > 0 ? (itemsSold / (orderCount * 5)) * 100 : 0; // Estimate 5 items viewed per order

    return {
      totalSales,
      itemsSold,
      wastePercentage: Math.round(wastePercentage * 10) / 10,
      revenueSaved: Math.round(revenueSaved * 100) / 100,
      topProduct,
      conversionRate: Math.round(conversionRate * 10) / 10,
      averageOrderValue:
        orderCount > 0 ? Math.round((totalSales / orderCount) * 100) / 100 : 0,
    };
  } catch (error) {
    console.error("Error fetching KPI metrics:", error);
    return {
      totalSales: 0,
      itemsSold: 0,
      wastePercentage: 0,
      revenueSaved: 0,
      topProduct: "N/A",
      conversionRate: 0,
      averageOrderValue: 0,
    };
  }
};
