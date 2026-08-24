"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { PromotionAnalyticsTable } from "@/components/analytics/PromotionAnalyticsTable";
import { analytics } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function PromotionsAnalyticsPage() {
  const [dateRange, setDateRange] = useState(() =>
    computePresetDates(DATE_PRESETS.find((p) => p.label === "Last 30 days") || { days: 30 })
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analytics.promotions({
        from: dateRange.from,
        to: dateRange.to,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load promotions analytics.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    analytics.exportCsv("promotions", { from: dateRange.from, to: dateRange.to });
  };

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumbs
          parts={[
            { label: "Dashboard", href: "/" },
            { label: "Analytics", href: "/analytics" },
            { label: "Promotions & Coupons" },
          ]}
        />
        <PageHeader
          title="Promotions & Discounts Performance"
          sub="Attributed revenue, discount costs, redemption volume, and coupon conversion metrics"
        />
      </div>

      <DateRangePicker
        from={dateRange.from}
        to={dateRange.to}
        compare={false}
        onChange={(r) => {
          setDateRange({ from: r.from, to: r.to });
          setPage(1);
        }}
        onRefresh={loadData}
        onExport={handleExport}
        loading={loading}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-line bg-red-wash px-4 py-3 text-[13px] text-red-deep">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Promotions Table & Summaries */}
      <PromotionAnalyticsTable
        summary={data?.summary}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        onExport={handleExport}
        loading={loading}
      />
    </div>
  );
}
