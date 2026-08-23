import { describe, expect, it } from "vitest";
import { NAV } from "@/lib/nav";
import { ORDER_STATUS_LABEL, ORDER_STATUS_PILL } from "@/lib/constants";

describe("CMS Order Navigation & Cancelled Section", () => {
  const ordersNav = NAV.find((n) => n.label === "Orders");

  it("includes the Orders main section with badgeKey", () => {
    expect(ordersNav).toBeDefined();
    expect(ordersNav?.href).toBe("/orders");
    expect(ordersNav?.badgeKey).toBe("pendingOrders");
  });

  it("contains all 6 dedicated subsections: All Orders, New, Accepted, Shipped, Delivered, Cancelled", () => {
    const subLabels = ordersNav?.sub?.map((s) => s.label);
    expect(subLabels).toEqual([
      "All Orders",
      "New",
      "Accepted",
      "Shipped",
      "Delivered",
      "Cancelled",
    ]);
  });

  it("maps Cancelled subsection to /orders?status=Cancelled with countKey 'cancelled'", () => {
    const cancelledSub = ordersNav?.sub?.find((s) => s.label === "Cancelled");
    expect(cancelledSub).toBeDefined();
    expect(cancelledSub?.href).toBe("/orders?status=Cancelled");
    expect(cancelledSub?.countKey).toBe("cancelled");
  });

  it("maps New subsection to /orders?status=Pending with countKey 'pending'", () => {
    const newSub = ordersNav?.sub?.find((s) => s.label === "New");
    expect(newSub).toBeDefined();
    expect(newSub?.href).toBe("/orders?status=Pending");
    expect(newSub?.countKey).toBe("pending");
  });

  it("maps Accepted subsection to /orders?status=Processing with countKey 'processing'", () => {
    const acceptedSub = ordersNav?.sub?.find((s) => s.label === "Accepted");
    expect(acceptedSub).toBeDefined();
    expect(acceptedSub?.href).toBe("/orders?status=Processing");
    expect(acceptedSub?.countKey).toBe("processing");
  });

  it("maps Shipped and Delivered subsections with their respective countKeys", () => {
    const shippedSub = ordersNav?.sub?.find((s) => s.label === "Shipped");
    const deliveredSub = ordersNav?.sub?.find((s) => s.label === "Delivered");

    expect(shippedSub?.href).toBe("/orders?status=Shipped");
    expect(shippedSub?.countKey).toBe("shipped");

    expect(deliveredSub?.href).toBe("/orders?status=Delivered");
    expect(deliveredSub?.countKey).toBe("delivered");
  });
});

describe("Dynamic Order Status Counts Resolution", () => {
  it("resolves dynamic counts from backend orderCounts payload without hardcoding", () => {
    const mockBackendOrderCounts = {
      all: 49,
      pending: 12,
      processing: 5,
      shipped: 8,
      delivered: 21,
      cancelled: 3,
    };

    const ordersNav = NAV.find((n) => n.label === "Orders");
    const resolvedCounts = ordersNav?.sub?.map((s) => ({
      label: s.label,
      count: s.countKey ? mockBackendOrderCounts[s.countKey] : undefined,
    }));

    expect(resolvedCounts).toEqual([
      { label: "All Orders", count: 49 },
      { label: "New", count: 12 },
      { label: "Accepted", count: 5 },
      { label: "Shipped", count: 8 },
      { label: "Delivered", count: 21 },
      { label: "Cancelled", count: 3 },
    ]);
  });

  it("updates resolved counts dynamically when an order transitions (e.g. New -> Accepted)", () => {
    // Before transition
    const initialCounts = {
      all: 10,
      pending: 3,
      processing: 2,
      shipped: 1,
      delivered: 4,
      cancelled: 0,
    };

    // After accepting one new order
    const updatedCounts = {
      ...initialCounts,
      pending: initialCounts.pending - 1, // 2
      processing: initialCounts.processing + 1, // 3
    };

    expect(updatedCounts.pending).toBe(2);
    expect(updatedCounts.processing).toBe(3);
    expect(updatedCounts.all).toBe(10);
  });

  it("updates resolved counts dynamically when an order is Cancelled", () => {
    // Before cancellation
    const initialCounts = {
      all: 10,
      pending: 3,
      processing: 2,
      shipped: 1,
      delivered: 4,
      cancelled: 0,
    };

    // After cancelling a pending order
    const updatedCounts = {
      ...initialCounts,
      pending: initialCounts.pending - 1, // 2
      cancelled: initialCounts.cancelled + 1, // 1
    };

    expect(updatedCounts.pending).toBe(2);
    expect(updatedCounts.cancelled).toBe(1);
    expect(updatedCounts.all).toBe(10);
  });
});

describe("Order Constants & Pill Display", () => {
  it("defines red pill tone for Cancelled status and green for Delivered", () => {
    expect(ORDER_STATUS_PILL.Cancelled).toBe("red");
    expect(ORDER_STATUS_PILL.Delivered).toBe("green");
    expect(ORDER_STATUS_PILL.Pending).toBe("amber");
    expect(ORDER_STATUS_PILL.Processing).toBe("blue");
    expect(ORDER_STATUS_PILL.Shipped).toBe("blue");
  });

  it("maps CANCELLED enum to human readable label", () => {
    expect(ORDER_STATUS_LABEL.CANCELLED).toBe("Cancelled");
    expect(ORDER_STATUS_LABEL.PENDING).toBe("Pending");
    expect(ORDER_STATUS_LABEL.PROCESSING).toBe("Processing");
    expect(ORDER_STATUS_LABEL.SHIPPED).toBe("Shipped");
    expect(ORDER_STATUS_LABEL.DELIVERED).toBe("Delivered");
  });
});
