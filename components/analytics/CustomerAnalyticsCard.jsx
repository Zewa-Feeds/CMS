"use client";

import { formatPaise } from "@/lib/api";
import { Users, UserCheck, Repeat, ShoppingBag } from "lucide-react";
import { Table, TableWrap, Th, Td, Tr } from "@/components/ui/Table";
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
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Users size={16} />
            <span className="text-[12.5px] font-medium">Registered Users</span>
          </div>
          <p className="mt-2 text-[20px] font-bold text-ink">
            {totalRegisteredCustomers.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <UserCheck size={16} />
            <span className="text-[12.5px] font-medium">Purchased Customers</span>
          </div>
          <p className="mt-2 text-[20px] font-bold text-ink">
            {totalCustomersWithOrders.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Repeat size={16} />
            <span className="text-[12.5px] font-medium">Repeat Customers</span>
          </div>
          <p className="mt-2 text-[20px] font-bold text-emerald-700">
            {repeatCustomersCount.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <ShoppingBag size={16} />
            <span className="text-[12.5px] font-medium">Repeat Purchase Rate</span>
          </div>
          <p className="mt-2 text-[20px] font-bold text-brand">
            {repeatPurchaseRatePct}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Spend Tiers */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h3 className="mb-3 text-[14px] font-semibold text-ink">Lifetime Spend Distribution</h3>
          <div className="space-y-2.5">
            {[
              { label: "Under ₹500", count: customerSpendTiers?.under500 || 0 },
              { label: "₹500 – ₹1,500", count: customerSpendTiers?.under1500 || 0 },
              { label: "₹1,500 – ₹5,000", count: customerSpendTiers?.under5000 || 0 },
              { label: "Above ₹5,000", count: customerSpendTiers?.above5000 || 0 },
            ].map((tier, i) => (
              <div key={i} className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-muted">{tier.label}</span>
                <span className="font-semibold text-ink">{tier.count} customers</span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-line-soft pt-3">
            <span className="text-[12px] font-medium text-muted">Period Order Types: </span>
            <span className="text-[12px] font-semibold text-ink">
              {guestVsRegisteredInPeriod?.registered || 0} Registered · {guestVsRegisteredInPeriod?.guest || 0} Guest
            </span>
          </div>
        </div>

        {/* Top 10 Customers */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm overflow-hidden">
          <h3 className="mb-3 text-[14px] font-semibold text-ink">Top Customers by Lifetime Value</h3>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Orders</Th>
                  <Th>Total Spend</Th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <Tr>
                    <Td colSpan={3} className="py-4 text-center text-muted">
                      No customer orders recorded yet.
                    </Td>
                  </Tr>
                ) : (
                  topCustomers.map((c, i) => (
                    <Tr key={i}>
                      <Td className="font-mono text-[12px] text-ink">{c.emailMasked}</Td>
                      <Td className="text-ink font-semibold">{c.orderCount}</Td>
                      <Td className="font-semibold text-ink">{formatPaise(c.totalSpendPaise)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      </div>
    </div>
  );
}
