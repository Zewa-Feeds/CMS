"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { ProductAnalyticsTable } from "@/components/analytics/ProductAnalyticsTable";
import { analytics, formatPaise } from "@/lib/api";
import { Package, TrendingUp, ShoppingBag, AlertCircle } from "lucide-react";

export default function ProductAnalyticsPage() {
  const [dateRange, setDateRange] = useState(() =>
    computePresetDates(DATE_PRESETS.find((p) => p.label === "Last 30 days") || { days: 30 })
  );
  const [sort, setSort] = useState("revenue");
  const [dir, setDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analytics.products({
        from: dateRange.from,
        to: dateRange.to,
        sort,
        dir,
        search,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load product analytics.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, sort, dir, search, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSortChange = (newSort) => {
    if (sort === newSort) {
      setDir(dir === "desc" ? "asc" : "desc");
    } else {
      setSort(newSort);
      setDir("desc");
    }
    setPage(1);
  };

  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    setPage(1);
  };

  const handleExport = () => {
    analytics.exportCsv("products", { from: dateRange.from, to: dateRange.to });
  };

  const productsList = data?.data || [];
  const totalUnits = productsList.reduce((sum, p) => sum + p.unitsSold, 0);
  const totalSales = productsList.reduce((sum, p) => sum + p.grossSalesPaise, 0);
  const topProduct = productsList[0];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Breadcrumbs
          parts={[
            { label: "Dashboard", href: "/" },
            { label: "Analytics", href: "/analytics" },
            { label: "Products Performance" },
          ]}
        />
        <PageHeader
          title="Product Sales Performance"
          sub="Catalogue revenue attribution, volume leaders, pack performance, and selling price trends"
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
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Highlights */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <ShoppingBag size={16} />
            <span className="text-[12.5px] font-medium">Period Units Sold</span>
          </div>
          <p className="mt-2 text-[22px] font-bold text-ink">
            {totalUnits.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <TrendingUp size={16} />
            <span className="text-[12.5px] font-medium">Period Catalogue Sales</span>
          </div>
          <p className="mt-2 text-[22px] font-bold text-ink">
            {formatPaise(totalSales)}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Package size={16} />
            <span className="text-[12.5px] font-medium">Revenue Leader</span>
          </div>
          <p className="mt-2 text-[15px] font-semibold text-brand truncate">
            {topProduct ? topProduct.productName : "—"}
          </p>
          {topProduct && (
            <span className="text-[11.5px] text-muted">
              {formatPaise(topProduct.grossSalesPaise)} · {topProduct.unitsSold} units
            </span>
          )}
        </div>
      </div>

      {/* Main Table */}
      <ProductAnalyticsTable
        data={productsList}
        meta={data?.meta}
        onSortChange={handleSortChange}
        onSearchChange={handleSearchChange}
        onPageChange={setPage}
        onExport={handleExport}
        loading={loading}
      />
    </div>
  );
}
