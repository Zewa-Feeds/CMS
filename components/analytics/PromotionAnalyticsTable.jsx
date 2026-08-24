"use client";

import Link from "next/link";
import { formatPaise } from "@/lib/api";
import { Table, TableWrap, Th, Td, Tr, Pager } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
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
          <Card className="p-4">
            <span className="text-[12.5px] font-medium text-muted">Total Redemptions</span>
            <p className="mt-2 font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-ink">
              {summary.totalRedemptions.toLocaleString("en-IN")}
            </p>
          </Card>
          <Card className="p-4">
            <span className="text-[12.5px] font-medium text-muted">Discounts Given</span>
            <p className="mt-2 font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-red-deep">
              {formatPaise(summary.totalDiscountsGivenPaise)}
            </p>
          </Card>
          <Card className="p-4">
            <span className="text-[12.5px] font-medium text-muted">Attributed Revenue</span>
            <p className="mt-2 font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-green-deep">
              {formatPaise(summary.totalAttributedRevenuePaise)}
            </p>
          </Card>
          <Card className="p-4">
            <span className="text-[12.5px] font-medium text-muted">Coupon Usage Rate</span>
            <p className="mt-2 font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-ink">
              {summary.couponUsageRatePct}%
            </p>
            <span className="mt-1 block font-mono text-[11px] text-muted">
              {summary.couponOrdersCount} of {summary.totalOrdersCount} orders
            </span>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHead className="justify-between">
          <CardTitle>Coupon Performance</CardTitle>
          {onExport && (
            <Button
              size="sm"
              variant="default"
              onClick={onExport}
              className="flex items-center gap-1.5"
            >
              <Download size={13} />
              Export Promotions CSV
            </Button>
          )}
        </CardHead>

        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Coupon Code</Th>
                <Th>Type & Trigger</Th>
                <Th right>Redemptions</Th>
                <Th right>Attributed Revenue</Th>
                <Th right>Discount Given</Th>
                <Th right>AOV</Th>
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
                  <Tr key={c.couponId || c.code} className="hover:bg-canvas">
                    <Td className="font-semibold text-ink font-mono text-[13px]">
                      <Link
                        href={`/coupons/${c.couponId}/edit`}
                        className="hover:text-teal hover:underline"
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
                    <Td right className="font-mono font-semibold text-ink">
                      {c.redemptionCount.toLocaleString("en-IN")}
                    </Td>
                    <Td right className="font-mono font-semibold text-ink">
                      {formatPaise(c.attributedRevenuePaise)}
                    </Td>
                    <Td right className="font-mono text-red-deep font-medium">
                      {formatPaise(c.discountCostPaise)}
                    </Td>
                    <Td right className="font-mono text-muted text-[12.5px]">
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

        {meta && (
          <Pager
            page={meta.page}
            pages={meta.totalPages}
            total={meta.totalCount}
            onPage={onPageChange}
            unit="coupons"
          />
        )}
      </Card>
    </div>
  );
}
