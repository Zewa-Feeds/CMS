"use client";

import Link from "next/link";
import { formatPaise } from "@/lib/api";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function PromotionAnalyticsTable({
  summary,
  data = [],
  meta,
  onPageChange,
  onExport,
  loading = false,
  className,
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <span className="text-[12px] font-medium text-muted">Total Redemptions</span>
            <p className="mt-1 text-[18px] font-bold text-ink">
              {summary.totalRedemptions.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <span className="text-[12px] font-medium text-muted">Discount Given</span>
            <p className="mt-1 text-[18px] font-bold text-red-600">
              {formatPaise(summary.totalDiscountsGivenPaise)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <span className="text-[12px] font-medium text-muted">Attributed Revenue</span>
            <p className="mt-1 text-[18px] font-bold text-emerald-700">
              {formatPaise(summary.totalAttributedRevenuePaise)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <span className="text-[12px] font-medium text-muted">Coupon Usage Rate</span>
            <p className="mt-1 text-[18px] font-bold text-brand">
              {summary.couponUsageRatePct}%
            </p>
            <span className="text-[11px] text-muted">
              {summary.couponOrdersCount} of {summary.totalOrdersCount} orders
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft p-4">
          <h3 className="text-[15px] font-semibold text-ink">Coupon Performance</h3>
          {onExport && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              className="flex items-center gap-1.5 h-8 text-[12px]"
            >
              <Download size={13} />
              Export Promotions CSV
            </Button>
          )}
        </div>

        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Coupon Code</Th>
                <Th>Type & Trigger</Th>
                <Th>Redemptions</Th>
                <Th>Attributed Revenue</Th>
                <Th>Discount Given</Th>
                <Th>AOV</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="py-8 text-center text-muted">
                    No coupon redemptions recorded for this date range.
                  </Td>
                </Tr>
              ) : (
                data.map((c) => (
                  <Tr key={c.couponId || c.code} className="hover:bg-surface-subtle">
                    <Td className="font-semibold text-ink font-mono text-[13px]">
                      <Link
                        href={`/coupons/${c.couponId}/edit`}
                        className="hover:text-brand hover:underline"
                      >
                        {c.code}
                      </Link>
                      {c.name && (
                        <span className="block text-[11.5px] font-sans font-normal text-muted">
                          {c.name}
                        </span>
                      )}
                    </Td>
                    <Td className="text-muted text-[12px]">
                      <span className="font-medium text-ink">{c.discountType}</span>
                      <span className="block text-[11px] text-muted">{c.trigger}</span>
                    </Td>
                    <Td className="font-semibold text-ink">
                      {c.redemptionCount.toLocaleString("en-IN")}
                    </Td>
                    <Td className="font-semibold text-ink">
                      {formatPaise(c.attributedRevenuePaise)}
                    </Td>
                    <Td className="text-red-600 font-medium">
                      {formatPaise(c.discountCostPaise)}
                    </Td>
                    <Td className="text-muted text-[12.5px]">
                      {formatPaise(c.aovPaise)}
                    </Td>
                    <Td>
                      <Pill tone={c.isActive ? "green" : "grey"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Pill>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line-soft p-3 text-[12.5px] text-muted">
            <span>
              Page {meta.page} of {meta.totalPages} ({meta.totalCount} coupons)
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
    </div>
  );
}
