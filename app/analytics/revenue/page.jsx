"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { TimeSeriesChart, BreakdownBarList } from "@/components/analytics/AnalyticsCharts";
import { GeographicTable } from "@/components/analytics/GeographicTable";
import { analytics } from "@/lib/api";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RevenueAnalyticsPage() {
  const [dateRange, setDateRange] = useState(() =>
    computePresetDates(DATE_PRESETS.find((p) => p.label === "Last 30 days") || { days: 30 })
  );
  const [interval, setInterval] = useState("day");
  const [activeMetric, setActiveMetric] = useState("grossRevenuePaise");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analytics.revenue({
        from: dateRange.from,
        to: dateRange.to,
        interval,
      });
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load revenue analytics.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, interval]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    analytics.exportCsv("revenue", { from: dateRange.from, to: dateRange.to });
  };

  const metricOptions = [
    { key: "grossRevenuePaise", label: "Gross Revenue", isCurrency: true },
    { key: "netRevenuePaise", label: "Net Revenue", isCurrency: true },
    { key: "discountPaise", label: "Discounts", isCurrency: true },
    { key: "shippingPaise", label: "Shipping", isCurrency: true },
    { key: "taxPaise", label: "Taxes", isCurrency: true },
    { key: "orders", label: "Order Count", isCurrency: false },
    { key: "itemsSold", label: "Units Sold", isCurrency: false },
  ];

  const currentMetric = metricOptions.find((m) => m.key === activeMetric) || metricOptions[0];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Breadcrumbs
          parts={[
            { label: "Dashboard", href: "/" },
            { label: "Analytics", href: "/analytics" },
            { label: "Revenue & Sales" },
          ]}
        />
        <PageHeader
          title="Revenue & Sales Analytics"
          sub="Financial breakdown across time periods, categories, payment methods, and geography"
        />
      </div>

      <DateRangePicker
        from={dateRange.from}
        to={dateRange.to}
        compare={false}
        onChange={(r) => setDateRange({ from: r.from, to: r.to })}
        onRefresh={loadData}
        onExport={handleExport}
        loading={loading}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Selector & Interval Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {metricOptions.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetric(m.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                activeMetric === m.key
                  ? "bg-brand text-white shadow-sm"
                  : "bg-surface-subtle text-ink hover:bg-line-soft"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-subtle p-1">
          {["day", "week", "month"].map((int) => (
            <button
              key={int}
              type="button"
              onClick={() => setInterval(int)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
                interval === int
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {int}
            </button>
          ))}
        </div>
      </div>

      {/* Main Time-Series Trend Chart */}
      <TimeSeriesChart
        title={`${currentMetric.label} Trend (${interval.toUpperCase()})`}
        data={data?.timeSeries || []}
        metric={currentMetric.key}
        isCurrency={currentMetric.isCurrency}
      />

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownBarList
          title="Revenue by Product Category"
          isCurrency={true}
          items={data?.byCategory?.map((c) => ({
            label: c.category,
            value: c.grossPaise,
          })) || []}
        />

        <BreakdownBarList
          title="Revenue by Payment Method"
          isCurrency={true}
          items={data?.byPaymentMethod?.map((p) => ({
            label: p.method,
            value: p.grossPaise,
          })) || []}
        />
      </div>

      {/* State Geographic Breakdown */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold text-ink">Regional Revenue Breakdown</h2>
        <GeographicTable
          data={data?.byState?.map((s) => ({
            state: s.state,
            orders: s.orders,
            grossRevenuePaise: s.grossPaise,
            shippingRevenuePaise: 0,
            aovPaise: s.orders > 0 ? Math.round(s.grossPaise / s.orders) : 0,
            revenueSharePct: 0,
          })) || []}
          onExport={() => analytics.exportCsv("geography", { from: dateRange.from, to: dateRange.to })}
        />
      </div>
    </div>
  );
}
