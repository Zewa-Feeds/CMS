"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Coins, Eye } from "lucide-react";
import { loyalty as loyaltyApi } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Z-Coin balances — ZSOP004 §9.4.
 *
 * "The main customer list gains an Outstanding Coin Balance column, sortable and
 * filterable. Also filterable by 'has pending coins', 'expiring in 30 days' and
 * 'negative balance', so campaigns and exceptions can be pulled without an
 * export."
 *
 * Kept as its own screen rather than a column bolted onto /customers: support
 * arrives here already asking a coin question, and the filters above are coin
 * filters that would be noise on the general customer list.
 *
 * Unlike the storefront, the CMS DOES show negative balances (§6.7 hides them
 * from customers only) — support cannot explain a deficit they cannot see.
 */

const FILTERS = [
  { value: "all", label: "All customers" },
  { value: "pending", label: "Has pending coins" },
  { value: "expiring", label: "Expiring in 30 days" },
  { value: "negative", label: "Negative balance" },
  { value: "flagged", label: "Flagged deficit" },
];

export default function LoyaltyBalancesPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("balance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loyaltyApi.customers({ filter, sort, limit: 100 });
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err?.message ?? "Could not load coin balances.");
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      void refetch();
      return;
    }
    const timer = setTimeout(() => void refetch(), 200);
    return () => clearTimeout(timer);
  }, [refetch]);

  return (
    <RoleGate perm="loyalty.view">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Zewa Coins" }]} />
      <PageHeader
        title="Zewa Coins"
        sub={`${total} ${total === 1 ? "account" : "accounts"}`}
        actions={
          <Link href="/loyalty/liability" className={button({ variant: "secondary" })}>
            <Coins size={15} />
            Liability
          </Link>
        }
      />

      <FilterBar>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="balance">Highest balance</option>
          <option value="recent">Most recent activity</option>
        </Select>
      </FilterBar>

      <Card>
        {error ? (
          <EmptyState title="Could not load balances" sub={error} />
        ) : loading ? (
          <EmptyState title="Loading…" sub="Fetching coin balances." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No accounts match"
            sub="Try a different filter, or wait for the first orders to earn coins."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>Customer</Th>
                  <Th align="right">Available</Th>
                  <Th align="right">Pending</Th>
                  <Th align="right">Lifetime earned</Th>
                  <Th align="right">Lifetime used</Th>
                  <Th>Status</Th>
                  <Th />
                </Tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name =
                    `${row.customer.firstName ?? ""} ${row.customer.lastName ?? ""}`.trim() ||
                    row.customer.email;
                  return (
                    <Tr key={row.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-2)]">
                            {initials(name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{name}</div>
                            <CellSub>{row.customer.email}</CellSub>
                          </div>
                        </div>
                      </Td>

                      {/*
                        A negative balance is SHOWN here, unlike the storefront.
                        §6.7 hides it from the customer; support has to see it.
                      */}
                      <Td align="right">
                        <span
                          className={`tabular-nums font-semibold ${
                            row.availableCoins < 0 ? "text-[var(--danger)]" : ""
                          }`}
                        >
                          {row.availableCoins.toLocaleString("en-IN")}
                        </span>
                      </Td>
                      <Td align="right" className="tabular-nums text-[var(--text-2)]">
                        {row.pendingCoins.toLocaleString("en-IN")}
                      </Td>
                      <Td align="right" className="tabular-nums text-[var(--text-2)]">
                        {row.lifetimeEarned.toLocaleString("en-IN")}
                      </Td>
                      <Td align="right" className="tabular-nums text-[var(--text-2)]">
                        {row.lifetimeRedeemed.toLocaleString("en-IN")}
                      </Td>

                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {row.status !== "ACTIVE" && <Pill tone="red">{row.status}</Pill>}
                          {row.flaggedDeficit > 0 && (
                            <Pill tone="amber">Deficit {row.flaggedDeficit}</Pill>
                          )}
                          {row.status === "ACTIVE" && row.flaggedDeficit === 0 && (
                            <Pill tone="green">Active</Pill>
                          )}
                        </div>
                      </Td>

                      <Td align="right">
                        <Link
                          href={`/loyalty/${row.customer.id}`}
                          className={button({ variant: "ghost", size: "sm" })}
                          aria-label={`View coin history for ${name}`}
                        >
                          <Eye size={14} />
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </RoleGate>
  );
}
