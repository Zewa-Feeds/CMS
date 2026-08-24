"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { TimeSeriesChart, BreakdownBarList } from "@/components/analytics/AnalyticsCharts";
import { analytics } from "@/lib/api";
import { Card } from "@/components/ui/Card";
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
    { key: "orders", label: "Orders", isCurrency: false },
    { key: "itemsSold", label: "Units Sold", isCurrency: false },
  ];

  const currentMetric = metricOptions.find((m) => m.key === activeMetric) || metricOptions[0];

  return (
    <div className="space-y-4">
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
        <div className="flex items-center gap-2 rounded-lg border border-red-line bg-red-wash px-4 py-3 text-[13px] text-red-deep">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Selector & Interval Controls Bar */}
      <Card className="p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {metricOptions.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetric(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                activeMetric === m.key
                  ? "bg-navy font-semibold text-white shadow-sm"
                  : "border border-line bg-card text-ink hover:bg-canvas"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-line bg-canvas p-1">
          {["day", "week", "month"].map((int) => (
            <button
              key={int}
              type="button"
              onClick={() => setInterval(int)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
                interval === int
                  ? "bg-card font-semibold text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {int}
            </button>
          ))}
        </div>
      </Card>

      {/* Main Time-Series Trend Chart */}
      <TimeSeriesChart
        title={`${currentMetric.label} Trend (${interval.toUpperCase()})`}
        data={data?.timeSeries || []}
        metric={currentMetric.key}
        isCurrency={currentMetric.isCurrency}
      />

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            label: p.method === "ONLINE" ? "Razorpay Online" : p.method === "COD" ? "Cash on Delivery" : p.method,
            value: p.grossPaise,
          })) || []}
        />
      </div>
    </div>
  );
}
