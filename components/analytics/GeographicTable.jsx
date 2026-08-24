"use client";

import { formatPaise } from "@/lib/api";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function GeographicTable({ data = [], onExport, className }) {
  const maxRevenue = Math.max(...data.map((d) => d.grossRevenuePaise), 1);

  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-sm overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-line-soft p-4">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">State Breakdown</h3>
          <p className="text-[12px] text-muted">Geographic order distribution and revenue density</p>
        </div>
        {onExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            className="flex items-center gap-1.5 h-8 text-[12px]"
          >
            <Download size={13} />
            Export States CSV
          </Button>
        )}
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>State</Th>
              <Th>Orders</Th>
              <Th>Gross Revenue</Th>
              <Th>Shipping Revenue</Th>
              <Th>AOV</Th>
              <Th>Revenue Share</Th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <Tr>
                <Td colSpan={6} className="py-8 text-center text-muted">
                  No state-level order data available for this range.
                </Td>
              </Tr>
            ) : (
              data.map((s) => {
                const shareWidth = Math.max(4, Math.round((s.grossRevenuePaise / maxRevenue) * 100));
                return (
                  <Tr key={s.state} className="hover:bg-surface-subtle">
                    <Td className="font-semibold text-ink">{s.state}</Td>
                    <Td className="text-ink">{s.orders.toLocaleString("en-IN")}</Td>
                    <Td className="font-semibold text-ink">{formatPaise(s.grossRevenuePaise)}</Td>
                    <Td className="text-muted">{formatPaise(s.shippingRevenuePaise)}</Td>
                    <Td className="text-muted">{formatPaise(s.aovPaise)}</Td>
                    <Td className="w-48">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${shareWidth}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] font-medium text-muted">
                          {s.revenueSharePct}%
                        </span>
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
