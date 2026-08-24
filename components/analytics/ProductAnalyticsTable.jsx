"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Download } from "lucide-react";
import { formatPaise } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Table, TableWrap, Th, Td, Tr, Pager } from "@/components/ui/Table";
import { Card, CardHead } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Page";
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
              <Th>Product</Th>
              <Th>SKU / Pack</Th>
              <Th>Category</Th>
              <Th right sortable onSort={() => onSortChange?.("units")}>
                Units Sold
              </Th>
              <Th right sortable onSort={() => onSortChange?.("orders")}>
                Orders
              </Th>
              <Th right sortable onSort={() => onSortChange?.("revenue")}>
                Gross Catalogue Sales
              </Th>
              <Th right>Avg Price</Th>
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
