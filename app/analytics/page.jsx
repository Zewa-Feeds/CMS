"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { KpiCard } from "@/components/analytics/KpiCard";
import { TimeSeriesChart, BreakdownBarList } from "@/components/analytics/AnalyticsCharts";
import { GeographicTable } from "@/components/analytics/GeographicTable";
import { CustomerAnalyticsCard } from "@/components/analytics/CustomerAnalyticsCard";
import { analytics } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function AnalyticsOverviewPage() {
  const [dateRange, setDateRange] = useState(() =>
    computePresetDates(DATE_PRESETS.find((p) => p.label === "Last 30 days") || { days: 30 })
  );
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, customersRes, geoRes] = await Promise.all([
        analytics.overview({ from: dateRange.from, to: dateRange.to, compare: String(compare) }),
        analytics.customers({ from: dateRange.from, to: dateRange.to }),
        analytics.geography({ from: dateRange.from, to: dateRange.to }),
      ]);
      setData(overviewRes);
      setCustomerData(customersRes);
      setGeoData(geoRes);
    } catch (err) {
      setError(err.message || "Failed to load analytics overview.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, compare]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    analytics.exportCsv("revenue", { from: dateRange.from, to: dateRange.to });
  };

  const kpis = data?.kpis;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Analytics Overview" }]} />
        <PageHeader
          title="E-Commerce Analytics"
          sub="Live operational performance, revenue trends, customer growth, and business KPIs"
        />
      </div>

      <DateRangePicker
        from={dateRange.from}
        to={dateRange.to}
        compare={compare}
        onChange={(r) => {
          setDateRange({ from: r.from, to: r.to });
          setCompare(r.compare !== false);
        }}
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

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Gross Revenue"
          isCurrency={true}
          delta={kpis?.grossRevenuePaise}
        />
        <KpiCard
          title="Net Revenue"
          isCurrency={true}
          delta={kpis?.netRevenuePaise}
        />
        <KpiCard
          title="Total Orders"
          isCurrency={false}
          delta={kpis?.totalOrders}
        />
        <KpiCard
          title="Avg Order Value"
          isCurrency={true}
          delta={kpis?.aovPaise}
        />
        <KpiCard
          title="Items Sold"
          isCurrency={false}
          delta={kpis?.itemsSold}
        />
        <KpiCard
          title="Customers"
          isCurrency={false}
          delta={kpis?.uniqueCustomers}
        />
      </div>

      {/* Secondary Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard
          title="Discounts Given"
          isCurrency={true}
          delta={kpis?.discountPaise}
          invertTone={true}
        />
        <KpiCard
          title="Shipping Revenue"
          isCurrency={true}
          delta={kpis?.shippingPaise}
        />
        <KpiCard
          title="GST Tax Collected"
          isCurrency={true}
          delta={kpis?.taxPaise}
        />
        <KpiCard
          title="Refunds"
          isCurrency={true}
          delta={kpis?.refundPaise}
          invertTone={true}
        />
        <KpiCard
          title="Coupon Orders"
          isCurrency={false}
          delta={kpis?.couponUsageCount}
        />
      </div>

      {/* Time-series Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Daily Gross Revenue Trend"
            data={data?.timeSeries || []}
            metric="grossRevenuePaise"
            isCurrency={true}
          />
        </div>
        <div className="space-y-4">
          <BreakdownBarList
            title="Orders by Status"
            isCurrency={false}
            items={[
              { label: "Delivered", value: data?.statusDistribution?.DELIVERED || 0 },
              { label: "Shipped", value: data?.statusDistribution?.SHIPPED || 0 },
              { label: "Processing", value: data?.statusDistribution?.PROCESSING || 0 },
              { label: "Pending", value: data?.statusDistribution?.PENDING || 0 },
              { label: "Cancelled", value: data?.statusDistribution?.CANCELLED || 0 },
            ]}
          />
        </div>
      </div>

      {/* Customer Insights Section */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold text-ink">Customer Insights</h2>
        <CustomerAnalyticsCard data={customerData} />
      </div>

      {/* Geographic Breakdown */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold text-ink">Regional Distribution</h2>
        <GeographicTable
          data={geoData?.data || []}
          onExport={() => analytics.exportCsv("geography", { from: dateRange.from, to: dateRange.to })}
        />
      </div>
    </div>
  );
}
