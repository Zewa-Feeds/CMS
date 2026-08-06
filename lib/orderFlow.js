// ==========================================================================
// ORDER LIFECYCLE — Pending → Processing → Shipped → Delivered
//
// Each step gates on the field it needs before it can be entered, and each
// sends its own transactional email (ZeptoMail, spec §15). Cancellation is
// available from any pre-delivery state.
// ==========================================================================

export const ORDER_FLOW = ["Pending", "Processing", "Shipped", "Delivered"];

export const STEPS = {
  Processing: {
    label: "Accept & invoice",
    verb: "Accept order",
    // spec §6.5 — the invoice number is entered as the order enters Processing
    requires: [
      {
        key: "inv",
        label: "Invoice Number",
        placeholder: "ZEW/26-27/0319",
        hint: "Generates the PDF invoice attached to the confirmation email.",
        mono: true,
      },
    ],
    email: {
      subject: "Your Zewa Feeds order is confirmed",
      blurb: "Order confirmed, with the invoice PDF attached.",
    },
  },
  Shipped: {
    label: "Mark shipped",
    verb: "Mark shipped",
    requires: [
      {
        key: "carrier",
        label: "Shipping Carrier",
        placeholder: "DTDC, Blue Dart, India Post…",
      },
      {
        key: "track",
        label: "Tracking Number",
        placeholder: "D77219845611",
        mono: true,
      },
    ],
    optional: [
      {
        key: "trackUrl",
        label: "Tracking URL",
        placeholder: "https://…",
        hint: "Included in the dispatch email so the customer can follow it.",
      },
    ],
    email: {
      subject: "Your order has shipped",
      blurb: "Dispatch notice with carrier and tracking details.",
    },
  },
  Delivered: {
    label: "Mark delivered",
    verb: "Mark delivered",
    requires: [],
    optional: [
      {
        key: "deliveredOn",
        label: "Delivered on",
        type: "date",
        hint: "Defaults to today if left blank.",
      },
    ],
    email: {
      subject: "Your order was delivered",
      blurb: "Delivery confirmation with a request to review the products.",
    },
  },
  Cancelled: {
    label: "Cancel order",
    verb: "Cancel order",
    danger: true,
    requires: [
      {
        key: "cancelReason",
        label: "Reason for cancellation",
        placeholder: "e.g. Customer requested cancellation",
        textarea: true,
      },
    ],
    email: {
      subject: "Your order was cancelled",
      blurb: "Cancellation notice with the reason.",
    },
  },
};

/** Which statuses can be moved to from `current`. */
export function nextStates(current) {
  if (current === "Delivered" || current === "Cancelled") return [];
  const i = ORDER_FLOW.indexOf(current);
  const forward = i >= 0 && i < ORDER_FLOW.length - 1 ? [ORDER_FLOW[i + 1]] : [];
  return [...forward, "Cancelled"];
}

/**
 * Display label for whatever the order carries.
 *
 * The API sends the ENUM in `status` ("PENDING") and the human label separately
 * in `statusLabel` ("Pending"). ORDER_FLOW holds labels, so comparing against
 * `status` made indexOf return -1 — every step then rendered as "todo", which is
 * why the tracker showed no progress at all.
 */
function statusLabelOf(order) {
  if (order.statusLabel) return order.statusLabel;
  const raw = String(order.status ?? "");
  // "PENDING" -> "Pending"; already-capitalised values pass through unchanged.
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/** Timeline model for the order detail page. */
export function timeline(order) {
  const status = statusLabelOf(order);
  // `placedAt` is what the API sends; `dt` was the mock field name.
  const placedAt = order.placedAt || order.dt || "";

  if (status === "Cancelled") {
    return [
      { label: "Placed", state: "done", at: placedAt },
      { label: "Cancelled", state: "cancelled", at: order.cancelledAt || "" },
    ];
  }

  const idx = ORDER_FLOW.indexOf(status);
  const at = {
    Pending: placedAt,
    Processing: order.acceptedAt,
    Shipped: order.shippedAt,
    Delivered: order.deliveredAt,
  };
  return ORDER_FLOW.map((s, i) => ({
    label: s === "Pending" ? "Placed" : s,
    // idx === -1 would mark everything "todo", so fall back to the first step.
    state: idx < 0 ? (i === 0 ? "current" : "todo") : i < idx ? "done" : i === idx ? "current" : "todo",
    at: at[s] || "",
  }));
}
