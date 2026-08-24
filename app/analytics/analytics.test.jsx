import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KpiCard } from "@/components/analytics/KpiCard";
import { DateRangePicker, computePresetDates } from "@/components/analytics/DateRangePicker";
import { ProductAnalyticsTable } from "@/components/analytics/ProductAnalyticsTable";
import { PromotionAnalyticsTable } from "@/components/analytics/PromotionAnalyticsTable";

describe("CMS Analytics UI Component Tests", () => {
  describe("KpiCard", () => {
    it("renders currency and positive delta correctly", () => {
      render(
        <KpiCard
          title="Gross Revenue"
          isCurrency={true}
          delta={{ current: 1500000, previous: 1200000, pctChange: 25.0, absChange: 300000 }}
        />
      );

      expect(screen.getByText("Gross Revenue")).toBeDefined();
      expect(screen.getByText("₹15,000")).toBeDefined();
      expect(screen.getByText("25%")).toBeDefined();
      expect(screen.getByText(/vs ₹12,000 previous period/)).toBeDefined();
    });

    it("renders inverted tone for refunds when increase is bad", () => {
      render(
        <KpiCard
          title="Refunds"
          isCurrency={true}
          invertTone={true}
          delta={{ current: 50000, previous: 20000, pctChange: 150.0, absChange: 30000 }}
        />
      );

      expect(screen.getByText("Refunds")).toBeDefined();
      const badge = screen.getByText("150%");
      expect(badge.className).toContain("text-red-700");
    });
  });

  describe("DateRangePicker presets", () => {
    it("computes last 30 days preset", () => {
      const dates = computePresetDates({ days: 30 });
      expect(dates.from).toBeDefined();
      expect(dates.to).toBeDefined();
    });

    it("triggers onChange when a preset button is clicked", () => {
      const onChange = vi.fn();
      render(
        <DateRangePicker
          from="2026-08-01"
          to="2026-08-24"
          compare={true}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText("Last 7 days"));
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("ProductAnalyticsTable", () => {
    it("renders product data rows correctly", () => {
      const mockProducts = [
        {
          sku: "F3-45G",
          productName: "Betta Bites F3",
          pack: "45g Bottle",
          category: "SLOW_SINKING_PELLETS",
          familySlug: "betta-bites",
          unitsSold: 25,
          orderCount: 18,
          grossSalesPaise: 462500,
          avgSellingPricePaise: 18500,
        },
      ];

      render(<ProductAnalyticsTable data={mockProducts} />);

      expect(screen.getByText("Betta Bites F3")).toBeDefined();
      expect(screen.getByText("F3-45G")).toBeDefined();
      expect(screen.getByText("25")).toBeDefined();
      expect(screen.getByText("₹4,625")).toBeDefined();
    });

    it("renders empty state message when no data is present", () => {
      render(<ProductAnalyticsTable data={[]} />);
      expect(screen.getByText(/No product sales data found/)).toBeDefined();
    });
  });

  describe("PromotionAnalyticsTable", () => {
    it("renders coupon rows and summary metrics", () => {
      const mockSummary = {
        totalRedemptions: 12,
        totalDiscountsGivenPaise: 25000,
        totalAttributedRevenuePaise: 300000,
        couponOrdersCount: 10,
        totalOrdersCount: 50,
        couponUsageRatePct: 20.0,
      };

      const mockCoupons = [
        {
          couponId: "c1",
          code: "WELCOME10",
          name: "Welcome Promo",
          discountType: "PERCENTAGE",
          discountValue: 10,
          trigger: "CODE",
          stackingMode: "NON_STACKABLE",
          isActive: true,
          redemptionCount: 12,
          attributedRevenuePaise: 300000,
          discountCostPaise: 25000,
          orderCount: 10,
          aovPaise: 25000,
        },
      ];

      render(<PromotionAnalyticsTable summary={mockSummary} data={mockCoupons} />);

      expect(screen.getByText("WELCOME10")).toBeDefined();
      expect(screen.getByText("Welcome Promo")).toBeDefined();
      expect(screen.getByText("20%")).toBeDefined(); // Usage rate
      expect(screen.getAllByText("₹3,000").length).toBeGreaterThan(0);
    });
  });
});
