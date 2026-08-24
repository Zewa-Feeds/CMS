"use client";

import { formatPaise } from "@/lib/api";
import { Users, UserCheck, Repeat, ShoppingBag } from "lucide-react";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function CustomerAnalyticsCard({ data, className }) {
  if (!data) return null;

  const {
    totalRegisteredCustomers,
    totalCustomersWithOrders,
    repeatCustomersCount,
    repeatPurchaseRatePct,
    guestVsRegisteredInPeriod,
    customerSpendTiers,
    topCustomers = [],
  } = data;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 4 Customer Highlights */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-blue-wash text-blue-deep">
            <Users size={19} />
          </span>
          <div>
            <span className="block font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-ink">
              {totalRegisteredCustomers.toLocaleString("en-IN")}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Registered Users</span>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-teal-wash text-teal-deep">
            <UserCheck size={19} />
          </span>
          <div>
            <span className="block font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-ink">
              {totalCustomersWithOrders.toLocaleString("en-IN")}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Purchased Customers</span>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-green-wash text-green-deep">
            <Repeat size={19} />
          </span>
          <div>
            <span className="block font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-green-deep">
              {repeatCustomersCount.toLocaleString("en-IN")}
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Repeat Customers</span>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-purple-wash text-purple-deep">
            <ShoppingBag size={19} />
          </span>
          <div>
            <span className="block font-mono text-[22px] font-semibold leading-none tracking-[-.02em] text-ink">
              {repeatPurchaseRatePct}%
            </span>
            <span className="mt-1 block text-[12.5px] text-muted">Repeat Purchase Rate</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Spend Tiers */}
        <Card>
          <CardHead>
            <CardTitle>Lifetime Spend Distribution</CardTitle>
          </CardHead>
          <div className="p-4 space-y-2.5">
            {[
              { label: "Under ₹500", count: customerSpendTiers?.under500 || 0 },
              { label: "₹500 – ₹1,500", count: customerSpendTiers?.under1500 || 0 },
              { label: "₹1,500 – ₹5,000", count: customerSpendTiers?.under5000 || 0 },
              { label: "Above ₹5,000", count: customerSpendTiers?.above5000 || 0 },
            ].map((tier, i) => (
              <div key={i} className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-muted">{tier.label}</span>
                <span className="font-mono font-semibold text-ink">{tier.count} customers</span>
              </div>
            ))}

            <div className="mt-4 border-t border-line-soft pt-3 text-[12px]">
              <span className="text-muted">Period Order Types: </span>
              <span className="font-medium text-ink">
                {guestVsRegisteredInPeriod?.registered || 0} Registered · {guestVsRegisteredInPeriod?.guest || 0} Guest
              </span>
            </div>
          </div>
        </Card>

        {/* Top 10 Customers */}
        <Card className="overflow-hidden">
          <CardHead>
            <CardTitle>Top Customers by Lifetime Value</CardTitle>
          </CardHead>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th right>Orders</Th>
                  <Th right>Total Spend</Th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <Tr>
                    <Td colSpan={3} className="py-6 text-center text-muted">
                      No customer orders recorded yet.
                    </Td>
                  </Tr>
                ) : (
                  topCustomers.map((c, i) => (
                    <Tr key={i} className="hover:bg-canvas">
                      <Td className="font-mono text-[12px] text-ink">{c.emailMasked}</Td>
                      <Td right className="font-mono font-semibold text-ink">{c.orderCount}</Td>
                      <Td right className="font-mono font-semibold text-ink">{formatPaise(c.totalSpendPaise)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
