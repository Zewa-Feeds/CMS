"use client";

import { formatPaise } from "@/lib/api";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function GeographicTable({ data = [], onExport, className }) {
  const maxRevenue = Math.max(...data.map((d) => d.grossRevenuePaise), 1);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHead className="justify-between">
        <div>
          <CardTitle>State Breakdown</CardTitle>
          <p className="mt-0.5 text-[12px] text-muted">Geographic order distribution and revenue density</p>
        </div>
        {onExport && (
          <Button
            size="sm"
            variant="default"
            onClick={onExport}
            className="flex items-center gap-1.5"
          >
            <Download size={13} />
            Export States CSV
          </Button>
        )}
      </CardHead>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>State</Th>
              <Th right>Orders</Th>
              <Th right>Gross Revenue</Th>
              <Th right>Shipping Revenue</Th>
              <Th right>AOV</Th>
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
                  <Tr key={s.state} className="hover:bg-canvas">
                    <Td className="font-semibold text-ink">{s.state}</Td>
                    <Td right className="font-mono text-ink">{s.orders.toLocaleString("en-IN")}</Td>
                    <Td right className="font-mono font-semibold text-ink">{formatPaise(s.grossRevenuePaise)}</Td>
                    <Td right className="font-mono text-muted">{formatPaise(s.shippingRevenuePaise)}</Td>
                    <Td right className="font-mono text-muted">{formatPaise(s.aovPaise)}</Td>
                    <Td className="w-48">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full border border-line-soft bg-canvas">
                          <div
                            className="h-full rounded-full bg-navy"
                            style={{ width: `${shareWidth}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11.5px] font-medium text-muted">
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
    </Card>
  );
}
