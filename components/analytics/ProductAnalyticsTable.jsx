"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { formatPaise } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Table, TableWrap, Th, Td, Tr, Pager } from "@/components/ui/Table";
import { Card, CardHead } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Page";
import { cn } from "@/lib/utils";

export function ProductAnalyticsTable({
  data = [],
  meta,
  sort: externalSort,
  dir: externalDir,
  onSortChange,
  onSearchChange,
  onPageChange,
  onExport,
  loading = false,
  className,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [internalSortKey, setInternalSortKey] = useState("revenue");
  const [internalSortDir, setInternalSortDir] = useState("desc");

  const currentSortKey = externalSort !== undefined ? externalSort : internalSortKey;
  const currentSortDir = externalDir !== undefined ? externalDir : internalSortDir;

  const handleSort = (key) => {
    if (onSortChange) {
      onSortChange(key);
    } else {
      if (internalSortKey === key) {
        setInternalSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setInternalSortKey(key);
        setInternalSortDir(key === "product" || key === "sku" || key === "category" ? "asc" : "desc");
      }
    }
  };

  const sortedList = useMemo(() => {
    const list = [...data];
    list.sort((a, b) => {
      let diff = 0;
      if (currentSortKey === "product") {
        diff = (a.productName || "").localeCompare(b.productName || "");
      } else if (currentSortKey === "sku") {
        diff = (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true });
      } else if (currentSortKey === "category") {
        diff = (a.category || "").localeCompare(b.category || "");
      } else if (currentSortKey === "units") {
        diff = (a.unitsSold ?? 0) - (b.unitsSold ?? 0);
      } else if (currentSortKey === "orders") {
        diff = (a.ordersCount ?? 0) - (b.ordersCount ?? 0);
      } else if (currentSortKey === "revenue") {
        diff = (a.grossSalesPaise ?? 0) - (b.grossSalesPaise ?? 0);
      } else if (currentSortKey === "avgPrice") {
        diff = (a.avgPricePaise ?? 0) - (b.avgPricePaise ?? 0);
      }
      return currentSortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [data, currentSortKey, currentSortDir]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange?.(searchInput);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHead className="justify-between">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <SearchInput
            placeholder="Search products or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-64"
          />
          <Button type="submit" size="sm" variant="default">
            Filter
          </Button>
        </form>

        {onExport && (
          <Button
            size="sm"
            variant="default"
            onClick={onExport}
            className="flex items-center gap-1.5"
          >
            <Download size={13} />
            Export Products CSV
          </Button>
        )}
      </CardHead>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th
                sortable
                active={currentSortKey === "product"}
                dir={currentSortDir}
                onSort={() => handleSort("product")}
              >
                Product
              </Th>
              <Th
                sortable
                active={currentSortKey === "sku"}
                dir={currentSortDir}
                onSort={() => handleSort("sku")}
              >
                SKU / Pack
              </Th>
              <Th
                sortable
                active={currentSortKey === "category"}
                dir={currentSortDir}
                onSort={() => handleSort("category")}
              >
                Category
              </Th>
              <Th
                right
                sortable
                active={currentSortKey === "units"}
                dir={currentSortDir}
                onSort={() => handleSort("units")}
              >
                Units Sold
              </Th>
              <Th
                right
                sortable
                active={currentSortKey === "orders"}
                dir={currentSortDir}
                onSort={() => handleSort("orders")}
              >
                Orders
              </Th>
              <Th
                right
                sortable
                active={currentSortKey === "revenue"}
                dir={currentSortDir}
                onSort={() => handleSort("revenue")}
              >
                Gross Catalogue Sales
              </Th>
              <Th
                right
                sortable
                active={currentSortKey === "avgPrice"}
                dir={currentSortDir}
                onSort={() => handleSort("avgPrice")}
              >
                Avg Price
              </Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Tr>
                <Td colSpan={7} className="py-8 text-center text-muted">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-soft border-t-navy" />
                    Loading…
                  </span>
                </Td>
              </Tr>
            ) : data.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="py-8 text-center text-muted">
                  No product sales data found for the selected period.
                </Td>
              </Tr>
            ) : (
              sortedList.map((p) => (
                <Tr key={p.sku} className="hover:bg-canvas">
                  <Td className="font-semibold text-ink">
                    {p.familySlug ? (
                      <Link
                        href={`/products/${p.familySlug}/edit`}
                        className="hover:text-teal hover:underline"
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
                  <Td right className="font-mono font-semibold text-ink">{p.unitsSold.toLocaleString("en-IN")}</Td>
                  <Td right className="font-mono text-ink">{p.orderCount.toLocaleString("en-IN")}</Td>
                  <Td right className="font-mono font-semibold text-ink">{formatPaise(p.grossSalesPaise)}</Td>
                  <Td right className="font-mono text-muted">{formatPaise(p.avgSellingPricePaise)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      {meta && (
        <Pager
          page={meta.page}
          pages={meta.totalPages}
          total={meta.totalCount}
          onPage={onPageChange}
          unit="products"
        />
      )}
    </Card>
  );
}
