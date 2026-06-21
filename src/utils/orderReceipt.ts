import type { BuyerOrder } from "@/src/services/firebase/orders";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatReceiptDate(date: BuyerOrder["createdAt"]): string {
  if (!date) return "—";
  const d =
    date instanceof Date
      ? date
      : typeof date === "object" && "toDate" in date
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as string);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildOrderReceiptHtml(order: BuyerOrder): string {
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const discount = order.discount ?? 0;
  const addr = order.shippingAddress;

  const itemRows = order.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      return `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.sellerName)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">RM${item.price.toFixed(2)}</td>
          <td class="num">RM${lineTotal.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LoveOvers Receipt #${orderRef}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 32px;
      background: #fff;
    }
    .header {
      border-bottom: 3px solid #6a3c00;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand { font-size: 28px; font-weight: 800; color: #6a3c00; margin: 0; }
    .subtitle { color: #666; margin: 4px 0 0; font-size: 14px; }
    .meta { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 24px; }
    .meta-block { min-width: 140px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #e5e5e5; color: #666; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .totals-row.total { font-size: 18px; font-weight: 800; color: #6a3c00; border-top: 2px solid #6a3c00; margin-top: 8px; padding-top: 12px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888; line-height: 1.5; }
    .badge { display: inline-block; background: #e7f1e5; color: #4a5d3a; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="brand">LoveOvers</h1>
    <p class="subtitle">Digital receipt · Thank you for fighting food waste</p>
  </div>

  <div class="meta">
    <div class="meta-block">
      <div class="label">Receipt no.</div>
      <div class="value">#${orderRef}</div>
    </div>
    <div class="meta-block">
      <div class="label">Order date</div>
      <div class="value">${escapeHtml(formatReceiptDate(order.createdAt))}</div>
    </div>
    <div class="meta-block">
      <div class="label">Status</div>
      <div class="value"><span class="badge">${escapeHtml(order.orderStatus)}</span></div>
    </div>
    <div class="meta-block">
      <div class="label">Payment</div>
      <div class="value">${escapeHtml(order.paymentStatus)}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <div class="label">Customer</div>
      <div class="value">${escapeHtml(addr.fullName || "—")}</div>
    </div>
    <div class="meta-block">
      <div class="label">Email</div>
      <div class="value">${escapeHtml(addr.email || "—")}</div>
    </div>
    <div class="meta-block">
      <div class="label">Phone</div>
      <div class="value">${escapeHtml(addr.phone || "—")}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Seller</th>
        <th class="num">Qty</th>
        <th class="num">Unit</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>RM${order.subtotal.toFixed(2)}</span></div>
    ${
      discount > 0
        ? `<div class="totals-row"><span>Discount</span><span>-RM${discount.toFixed(2)}</span></div>`
        : ""
    }
    <div class="totals-row total"><span>Total paid</span><span>RM${order.total.toFixed(2)}</span></div>
  </div>

  <div class="footer">
    <p>This is a computer-generated receipt from LoveOvers. Pickup details were provided at checkout.</p>
    <p>Payment reference: ${escapeHtml(order.paymentIntentId || "—")}</p>
  </div>
</body>
</html>`;
}

export async function generateAndShareOrderReceipt(
  order: BuyerOrder,
): Promise<void> {
  const html = buildOrderReceiptHtml(order);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    if (Platform.OS === "web") {
      Alert.alert(
        "Receipt ready",
        "Receipt PDF was generated. Sharing is not available in this browser.",
      );
      return;
    }
    Alert.alert(
      "Receipt saved",
      `Your receipt PDF was saved to:\n${uri}`,
    );
    return;
  }

  await Sharing.shareAsync(uri, {
    UTI: ".pdf",
    mimeType: "application/pdf",
    dialogTitle: `LoveOvers receipt #${order.id.slice(0, 8).toUpperCase()}`,
  });
}
