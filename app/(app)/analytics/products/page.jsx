"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { DateRangePicker, computePresetDates, DATE_PRESETS } from "@/components/analytics/DateRangePicker";
import { ProductAnalyticsTable } from "@/components/analytics/ProductAnalyticsTable";
import { analytics, formatPaise } from "@/lib/api";
import { Card } from "@/components/ui/Card";
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
    <div className="space-y-4">
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
        <div className="flex items-center gap-2 rounded-lg border border-red-line bg-red-wash px-4 py-3 text-[13px] text-red-deep">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-blue-wash text-blue-deep">
            <ShoppingBag size={19} />
          </span>
          <div>
            <span className="block font-mono text-[24px] font-semibold leading-none tracking-[-.02em] text-ink">
              {loading && !data ? "—" : totalUnits.toLocaleString("en-IN")}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Units Sold in Period</span>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-teal-wash text-teal-deep">
            <TrendingUp size={19} />
          </span>
          <div>
            <span className="block font-mono text-[24px] font-semibold leading-none tracking-[-.02em] text-ink">
              {loading && !data ? "—" : formatPaise(totalSales)}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Catalogue Line Sales</span>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-amber-wash text-amber-deep">
            <Package size={19} />
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[14.5px] font-semibold text-ink">
              {topProduct ? topProduct.productName : "—"}
            </span>
            <span className="mt-1 block text-[12px] text-muted font-mono">
              {topProduct ? `${formatPaise(topProduct.grossSalesPaise)} · ${topProduct.unitsSold} units` : "Top volume leader"}
            </span>
          </div>
        </Card>
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
