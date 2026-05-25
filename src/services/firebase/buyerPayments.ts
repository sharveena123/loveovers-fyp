import {
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import {
  BuyerOrder,
  getBuyerOrders,
  updateBuyerOrderStatus,
} from "./orders";

export type RefundStatus =
  | "none"
  | "requested"
  | "processing"
  | "approved"
  | "rejected"
  | "refunded";

export interface BuyerTransaction {
  id: string;
  orderId: string;
  type: "payment" | "refund";
  amount: number;
  currency: "MYR";
  paymentStatus: BuyerOrder["paymentStatus"];
  orderStatus: BuyerOrder["orderStatus"];
  refundStatus?: RefundStatus;
  description: string;
  sellerName: string;
  paymentIntentId: string;
  createdAt: Date;
}

export const REFUND_REASONS = [
  "Order cancelled by seller",
  "Could not pick up order",
  "Wrong or poor quality items",
  "Duplicate charge",
  "Other",
] as const;

function toDate(value: Timestamp | Date | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string);
}

function orderSellerLabel(order: BuyerOrder): string {
  const names = [
    ...new Set(
      (order.items ?? []).map((i) => i.sellerName).filter(Boolean),
    ),
  ];
  return names.length === 1
    ? names[0]
    : names.length > 1
      ? `${names[0]} +${names.length - 1}`
      : "Seller";
}

function itemPreview(order: BuyerOrder): string {
  if (!order.items?.length) return "Order";
  return order.items.length === 1
    ? order.items[0].name
    : `${order.items[0].name} +${order.items.length - 1}`;
}

export function getRefundStatus(
  order: BuyerOrder,
): RefundStatus {
  if (order.refundStatus) return order.refundStatus;
  if (order.paymentStatus === "refunded") return "refunded";
  return "none";
}

export function canRequestRefund(order: BuyerOrder): {
  eligible: boolean;
  reason?: string;
} {
  const refund = getRefundStatus(order);

  if (["requested", "processing", "approved", "refunded"].includes(refund)) {
    return {
      eligible: false,
      reason: "A refund is already in progress or completed",
    };
  }

  if (order.paymentStatus === "refunded") {
    return { eligible: false, reason: "This order was already refunded" };
  }

  if (!["succeeded", "pending", "refund_pending"].includes(order.paymentStatus)) {
    return {
      eligible: false,
      reason: "No completed payment found for this order",
    };
  }

  if (order.orderStatus === "delivered") {
    const days =
      (Date.now() - toDate(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 14) {
      return { eligible: false, reason: "Refund window closed (14 days after order)" };
    }
    return { eligible: true };
  }

  if (["cancelled", "pending", "ready"].includes(order.orderStatus)) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason: "This order status is not eligible for a refund",
  };
}

export async function getBuyerTransactions(
  userId: string,
): Promise<BuyerTransaction[]> {
  const orders = await getBuyerOrders(userId);
  const transactions: BuyerTransaction[] = [];

  for (const order of orders) {
    const createdAt = toDate(order.createdAt);
    const sellerName = orderSellerLabel(order);
    const preview = itemPreview(order);

    transactions.push({
      id: `pay-${order.id}`,
      orderId: order.id,
      type: "payment",
      amount: order.total,
      currency: "MYR",
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      refundStatus: getRefundStatus(order),
      description: preview,
      sellerName,
      paymentIntentId: order.paymentIntentId,
      createdAt,
    });

    const refund = getRefundStatus(order);
    if (refund === "refunded" || order.paymentStatus === "refunded") {
      transactions.push({
        id: `ref-${order.id}`,
        orderId: order.id,
        type: "refund",
        amount: order.refundedAmount ?? order.total,
        currency: "MYR",
        paymentStatus: "refunded",
        orderStatus: order.orderStatus,
        refundStatus: "refunded",
        description: `Refund · ${preview}`,
        sellerName,
        paymentIntentId: order.paymentIntentId,
        createdAt: toDate(order.refundedAt) || createdAt,
      });
    }
  }

  return transactions.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getBuyerRefundOrders(
  userId: string,
): Promise<BuyerOrder[]> {
  const orders = await getBuyerOrders(userId);
  return orders
    .filter((o) => {
      const refund = getRefundStatus(o);
      return (
        canRequestRefund(o).eligible ||
        ["requested", "processing", "approved", "rejected", "refunded"].includes(
          refund,
        )
      );
    })
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runTestPaymentRefundPipeline(
  userId: string,
  orderId: string,
  amount: number,
): Promise<void> {
  await delay(600);
  await updateBuyerOrderStatus(userId, orderId, {
    refundStatus: "processing",
  });
  await delay(900);
  await updateBuyerOrderStatus(userId, orderId, {
    refundStatus: "refunded",
    paymentStatus: "refunded",
    refundedAt: Timestamp.now(),
    refundedAmount: amount,
  });

  const { createRefundProcessedNotification } = await import(
    "./notificationServices"
  );
  await createRefundProcessedNotification(userId, orderId, amount);
}

export async function requestBuyerRefund(
  userId: string,
  order: BuyerOrder,
  reason: string,
): Promise<void> {
  const check = canRequestRefund(order);
  if (!check.eligible) {
    throw new Error(check.reason || "Order not eligible for refund");
  }

  await updateBuyerOrderStatus(userId, order.id, {
    refundStatus: "requested",
    refundReason: reason.trim(),
    refundRequestedAt: Timestamp.now(),
    paymentStatus: "refund_pending",
  });

  await addDoc(collection(db, "users", userId, "refundRequests"), {
    orderId: order.id,
    amount: order.total,
    reason: reason.trim(),
    status: "requested",
    paymentIntentId: order.paymentIntentId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  if (order.paymentIntentId?.startsWith("pi_test")) {
    await runTestPaymentRefundPipeline(userId, order.id, order.total);
  }
}
