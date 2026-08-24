import { describe, expect, it } from "vitest";
import { INDIAN_STATES } from "@/lib/constants";

describe("Weight-Slab Shipping in CMS Settings", () => {
  it("includes all 36 Indian states and union territories for forms", () => {
    expect(INDIAN_STATES).toContain("Maharashtra");
    expect(INDIAN_STATES).toContain("Karnataka");
    expect(INDIAN_STATES).toContain("Gujarat");
    expect(INDIAN_STATES).toContain("Delhi");
    expect(INDIAN_STATES).toContain("Tamil Nadu");
    expect(INDIAN_STATES).toContain("Jammu & Kashmir");
    expect(INDIAN_STATES).toContain("Andaman & Nicobar Islands");
    expect(INDIAN_STATES).toContain("Dadra & Nagar Haveli and Daman & Diu");
    expect(INDIAN_STATES.length).toBe(36);
  });

  it("correctly converts weight-slab shipping settings from API paise to form rupees", () => {
    const apiPayload = {
      shipping: {
        keralaRatePerKgPaise: 4500, // ₹45
        outsideKeralaRatePerKgPaise: 7000, // ₹70
        packagingWeightGrams: 100,
        slabWeightGrams: 500,
        freeThresholdPaise: 99900, // ₹999
        standardRatePaise: 6000,
        deliveryText: "3–5 business days",
        pinBlacklist: ["400001", "682001"],
      },
    };

    const formShipping = {
      keralaRatePerKg: (apiPayload.shipping.keralaRatePerKgPaise ?? 4500) / 100,
      outsideKeralaRatePerKg: (apiPayload.shipping.outsideKeralaRatePerKgPaise ?? 7000) / 100,
      packagingWeightGrams: apiPayload.shipping.packagingWeightGrams ?? 100,
      slabWeightGrams: apiPayload.shipping.slabWeightGrams ?? 500,
      freeThreshold: (apiPayload.shipping.freeThresholdPaise ?? 0) / 100,
      standardRate: (apiPayload.shipping.standardRatePaise ?? 6000) / 100,
      deliveryText: apiPayload.shipping.deliveryText ?? "",
      pinBlacklist: (apiPayload.shipping.pinBlacklist ?? []).join(", "),
    };

    expect(formShipping.keralaRatePerKg).toBe(45);
    expect(formShipping.outsideKeralaRatePerKg).toBe(70);
    expect(formShipping.packagingWeightGrams).toBe(100);
    expect(formShipping.slabWeightGrams).toBe(500);
    expect(formShipping.freeThreshold).toBe(999);
    expect(formShipping.pinBlacklist).toBe("400001, 682001");
  });

  it("correctly converts form values to API paise on save", () => {
    const formShipping = {
      keralaRatePerKg: "45",
      outsideKeralaRatePerKg: "70",
      packagingWeightGrams: "100",
      slabWeightGrams: "500",
      freeThreshold: "999",
      standardRate: "60",
      deliveryText: "3-5 days",
      pinBlacklist: "400001, 682001",
    };

    const payload = {
      keralaRatePerKgPaise: Math.round(Number(formShipping.keralaRatePerKg || 0) * 100),
      outsideKeralaRatePerKgPaise: Math.round(Number(formShipping.outsideKeralaRatePerKg || 0) * 100),
      packagingWeightGrams: Math.max(0, Math.round(Number(formShipping.packagingWeightGrams || 100))),
      slabWeightGrams: Math.max(1, Math.round(Number(formShipping.slabWeightGrams || 500))),
      freeThresholdPaise: Math.round(Number(formShipping.freeThreshold || 0) * 100),
      standardRatePaise: Math.round(Number(formShipping.standardRate || 60) * 100),
      deliveryText: formShipping.deliveryText,
      pinBlacklist: String(formShipping.pinBlacklist)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{6}$/.test(s)),
    };

    expect(payload.keralaRatePerKgPaise).toBe(4500);
    expect(payload.outsideKeralaRatePerKgPaise).toBe(7000);
    expect(payload.packagingWeightGrams).toBe(100);
    expect(payload.slabWeightGrams).toBe(500);
    expect(payload.freeThresholdPaise).toBe(99900);
    expect(payload.pinBlacklist).toEqual(["400001", "682001"]);
  });
});
