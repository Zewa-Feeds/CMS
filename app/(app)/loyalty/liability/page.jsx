"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { loyalty as loyaltyApi, API_BASE } from "@/lib/api";
import { inr } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState, useSortableTable } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Coin liability — ZSOP004 §9.4, §11.1, §11.3.
 *
 * "Live outstanding liability, daily movement, ageing by expiry bucket, and the
 * exception list."
 *
 * The distinction that matters to finance, and the reason the two figures are
 * presented separately rather than summed: §11.1 recognises the liability at
 * UNLOCK, not at issuance. Pending coins are contingent — a return voids them
 * entirely — so they carry no accounting entry yet. Showing one total would
 * overstate the balance-sheet liability by whatever is still in the return
 * window.
 */

export default function LoyaltyLiabilityPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  const exceptions = data?.exceptions ?? [];
  const {
    sortedItems: sortedExceptions,
    sortKey: excSortKey,
    sortDir: excSortDir,
    toggleSort: toggleExcSort,
  } = useSortableTable(
    exceptions,
    { key: null, dir: "asc" },
    {
      customer: (r) =>
        `${r.customer?.firstName ?? ""} ${r.customer?.lastName ?? ""}`.trim() ||
        r.customer?.email ||
        "",
      available: (r) => r.availableCoins ?? 0,
      deficit: (r) => r.flaggedDeficit ?? 0,
      issue: (r) => (r.availableCoins < 0 ? "Negative" : r.flaggedDeficit > 0 ? "Deficit" : ""),
    }
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loyaltyApi.liability());
    } catch (err) {
      setError(err?.message ?? "Could not load the liability report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runReconcile() {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const report = await loyaltyApi.reconcile();
      setReconcileResult(report);
      await load();
    } catch (err) {
      setError(err?.message ?? "Reconciliation failed.");
    } finally {
      setReconciling(false);
    }
  }

  return (
    <RoleGate perm="loyalty.view">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Zewa Coins", href: "/loyalty" },
          { label: "Liability" },
        ]}
      />
      <PageHeader
        title="Coin liability"
        sub="Outstanding coins, ageing and exceptions"
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runReconcile}
              disabled={reconciling}
              className={button({ variant: "secondary" })}
            >
              <RefreshCw size={15} />
              {reconciling ? "Reconciling…" : "Reconcile now"}
            </button>
            {/*
              A plain link: the export endpoint streams CSV and the browser
              handles the download. It needs the session cookie, which a fetch
              would also carry, but a link avoids buffering the whole file in JS.
            */}
            <a
              href={`${API_BASE}/loyalty/export`}
              className={button({ variant: "secondary" })}
            >
              <Download size={15} />
              Export CSV
            </a>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-[var(--danger)]/30">
          <CardBody>
            <p className="text-[13px] text-[var(--danger)]">{error}</p>
          </CardBody>
        </Card>
      )}

      {reconcileResult && (
        <Card className="mb-4">
          <CardBody>
            <p className="text-[13px]">
              Checked {reconcileResult.checked} accounts.{" "}
              {reconcileResult.repaired === 0 ? (
                <span className="text-[var(--success)]">No drift found.</span>
              ) : (
                <span className="text-[var(--danger)]">
                  Repaired {reconcileResult.repaired} to the ledger
                  {reconcileResult.blocked > 0 &&
                    `, blocked redemption on ${reconcileResult.blocked}`}
                  .
                </span>
              )}
            </p>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <EmptyState title="Loading…" sub="Calculating outstanding liability." />
        </Card>
      ) : data ? (
        <>
          {/* ---- The two figures finance needs kept apart (§11.1) ---- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardBody>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                  Outstanding liability
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {inr(data.outstandingLiabilityPaise)}
                </div>
                <CellSub>
                  {data.outstandingCoins.toLocaleString("en-IN")} unlocked coins — on the balance
                  sheet
                </CellSub>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                  Pending (contingent)
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-2)]">
                  {data.pendingCoins.toLocaleString("en-IN")}
                </div>
                <CellSub>
                  No entry yet — a return voids these before they unlock (§11.1)
                </CellSub>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                  Exceptions
                </div>
                <div
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    data.exceptions.length > 0 ? "text-[var(--danger)]" : ""
                  }`}
                >
                  {data.exceptions.length}
                </div>
                <CellSub>Negative balances, flagged deficits, reconciliation drift</CellSub>
              </CardBody>
            </Card>
          </div>

          {/* ---- Ageing: when the liability actually falls due ---- */}
          <Card className="mt-4">
            <CardHead>
              <CardTitle>Ageing by expiry</CardTitle>
            </CardHead>
            <CardBody>
              <p className="mb-3 text-[13px] text-[var(--text-2)]">
                Coins expire 12 months after they are earned. Anything unspent by then reverses
                out as breakage.
              </p>
              <div className="flex flex-col gap-2">
                {data.ageing.map((bucket, i) => {
                  const max = Math.max(...data.ageing.map((b) => b.coins), 1);
                  const prev = i === 0 ? 0 : data.ageing[i - 1].withinDays;
                  return (
                    <div key={bucket.withinDays} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[12px] text-[var(--text-2)]">
                        {prev}–{bucket.withinDays} days
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(bucket.coins / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right text-[12px] tabular-nums">
                        {bucket.coins.toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* ---- Exceptions: surfaced, never absorbed (§9.2) ---- */}
          <Card className="mt-4">
            <CardHead>
              <CardTitle>Exceptions</CardTitle>
            </CardHead>
            {data.exceptions.length === 0 ? (
              <EmptyState
                title="No exceptions"
                sub="Every balance reconciles and no account is in deficit."
              />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <Tr>
                      <Th
                        sortable
                        active={excSortKey === "customer"}
                        dir={excSortDir}
                        onSort={() => toggleExcSort("customer", "asc")}
                      >
                        Customer
                      </Th>
                      <Th
                        align="right"
                        sortable
                        active={excSortKey === "available"}
                        dir={excSortDir}
                        onSort={() => toggleExcSort("available", "desc")}
                      >
                        Available
                      </Th>
                      <Th
                        align="right"
                        sortable
                        active={excSortKey === "deficit"}
                        dir={excSortDir}
                        onSort={() => toggleExcSort("deficit", "desc")}
                      >
                        Flagged deficit
                      </Th>
                      <Th
                        sortable
                        active={excSortKey === "issue"}
                        dir={excSortDir}
                        onSort={() => toggleExcSort("issue", "asc")}
                      >
                        Issue
                      </Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {sortedExceptions.map((row) => (
                      <Tr key={row.id}>
                        <Td>
                          <Link
                            href={`/loyalty/${row.customer.id}`}
                            className="text-[var(--accent)] hover:underline"
                          >
                            {`${row.customer.firstName ?? ""} ${row.customer.lastName ?? ""}`.trim() ||
                              row.customer.email}
                          </Link>
                          <CellSub>{row.customer.email}</CellSub>
                        </Td>
                        <Td
                          align="right"
                          className={`tabular-nums ${
                            row.availableCoins < 0 ? "text-[var(--danger)] font-semibold" : ""
                          }`}
                        >
                          {row.availableCoins}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {row.flaggedDeficit || "—"}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1.5">
                            {row.availableCoins < 0 && <Pill tone="amber">Negative</Pill>}
                            {row.flaggedDeficit > 0 && <Pill tone="red">Deficit</Pill>}
                            {row.mismatchStreak >= 1 && (
                              <Pill tone="red">
                                Drift ×{row.mismatchStreak}
                                {row.mismatchStreak >= 2 && " — redemption blocked"}
                              </Pill>
                            )}
                            {row.status !== "ACTIVE" && <Pill tone="grey">{row.status}</Pill>}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </>
      ) : null}
    </RoleGate>
  );
}
