"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search, Download } from "lucide-react";
import { formatPaise } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/utils";

export function ProductAnalyticsTable({
  data = [],
  meta,
  onSortChange,
  onSearchChange,
  onPageChange,
  onExport,
  loading = false,
  className,
}) {
  const [searchInput, setSearchInput] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange?.(searchInput);
  };

  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-sm overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search products or SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface pl-8 pr-3 text-[12.5px] text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8 text-[12px]">
            Filter
          </Button>
        </form>

        {onExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            className="flex items-center gap-1.5 h-8 text-[12px]"
          >
            <Download size={13} />
            Export Products CSV
          </Button>
        )}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU / Pack</Th>
              <Th>Category</Th>
              <Th>
                <button
                  type="button"
                  onClick={() => onSortChange?.("units")}
                  className="flex items-center gap-1 hover:text-ink font-semibold"
                >
                  Units Sold
                  <ArrowUpDown size={12} />
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => onSortChange?.("orders")}
                  className="flex items-center gap-1 hover:text-ink font-semibold"
                >
                  Orders
                  <ArrowUpDown size={12} />
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => onSortChange?.("revenue")}
                  className="flex items-center gap-1 hover:text-ink font-semibold"
                  title="Catalogue line total before cart-level coupon discounts"
                >
                  Gross Catalogue Sales
                  <ArrowUpDown size={12} />
                </button>
              </Th>
              <Th>Avg Price</Th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="py-8 text-center text-muted">
                  No product sales data found for the selected period.
                </Td>
              </Tr>
            ) : (
              data.map((p) => (
                <Tr key={p.sku} className="hover:bg-surface-subtle">
                  <Td className="font-medium text-ink">
                    {p.familySlug ? (
                      <Link
                        href={`/products/${p.familySlug}/edit`}
                        className="hover:text-brand hover:underline font-semibold"
                      >
                        {p.productName}
                      </Link>
                    ) : (
                      p.productName
                    )}
                  </Td>
                  <Td className="text-muted text-[12.5px]">
                    <span className="font-mono text-[11.5px] text-ink">{p.sku}</span> · {p.pack}
                  </Td>
                  <Td className="text-muted text-[12px]">{p.category}</Td>
                  <Td className="font-semibold text-ink">{p.unitsSold.toLocaleString("en-IN")}</Td>
                  <Td className="text-ink">{p.orderCount.toLocaleString("en-IN")}</Td>
                  <Td className="font-semibold text-ink">{formatPaise(p.grossSalesPaise)}</Td>
                  <Td className="text-muted">{formatPaise(p.avgSellingPricePaise)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line-soft p-3 text-[12.5px] text-muted">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.totalCount} products)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page <= 1}
              onClick={() => onPageChange?.(meta.page - 1)}
              className="h-7 px-2 text-[12px]"
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange?.(meta.page + 1)}
              className="h-7 px-2 text-[12px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
