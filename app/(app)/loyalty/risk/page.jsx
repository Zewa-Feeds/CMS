"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { loyalty as loyaltyApi } from "@/lib/api";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Fraud and risk monitoring — ZSOP004 §12.1.
 *
 * "Real-time alerts on outsized single-account earning or single-order
 * redemption … daily issuance and redemption against the trailing 7-day
 * average, plus counts of negative balances and flagged deficits; weekly review
 * of high-return accounts holding balances."
 *
 * This screen decides nothing. Every control it reports on is enforced in the
 * services — the RTO counter disables earning and COD, the −50 floor freezes an
 * account, reconciliation blocks redemption after two mismatches. What is shown
 * here is what a human should look at, which is a different job from what the
 * system should do, and keeping them separate is why the page is read-only.
 *
 * The one genuinely open exposure is `largeRedemptionsUnverified`: §12.1 wants
 * OTP re-verification above the coin threshold, Zewa has no SMS provider, and
 * redemption is deliberately NOT refused in its absence (refusing would invent a
 * rule §4 does not contain). Counting those redemptions makes the gap a number
 * on a dashboard rather than a silence nobody notices.
 */

/** Severity for a count that should normally be zero. */
function exceptionTone(n) {
  return n > 0 ? "red" : "green";
}

export default function LoyaltyRiskPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loyaltyApi.risk());
    } catch (err) {
      setError(err?.message ?? "Could not load the risk report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const volume = data?.volume;

  return (
    <RoleGate perm="loyalty.view">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Zewa Coins", href: "/loyalty" },
          { label: "Risk" },
        ]}
      />
      <PageHeader
        title="Fraud & risk"
        sub="Exceptions, volume anomalies and accounts worth a look"
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={button({ variant: "secondary" })}
          >
            <RefreshCw size={15} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && (
        <Card className="mb-4 border-[var(--danger)]/30">
          <CardBody>
            <p className="text-[13px] text-[var(--danger)]">{error}</p>
          </CardBody>
        </Card>
      )}

      {loading && !data ? (
        <Card>
          <EmptyState title="Loading…" sub="Gathering risk signals." />
        </Card>
      ) : data ? (
        <>
          {/* ---- Exception counts. All of these should read zero. ---- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Negative balances",
                value: data.negativeBalances,
                sub: "Clawback exceeded the balance (§6.7)",
              },
              {
                label: "Flagged deficits",
                value: data.flaggedDeficits,
                sub: "Shortfall beyond the −50 floor",
              },
              {
                label: "Frozen accounts",
                value: data.frozenAccounts,
                sub: "Held for review (§8.4 #30)",
              },
              {
                label: "At the RTO limit",
                value: data.highRtoAccounts,
                sub: "Earning off, prepaid only (§12.1)",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardBody>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                    {stat.label}
                  </div>
                  <div
                    className={`mt-1 text-2xl font-semibold tabular-nums ${
                      stat.value > 0 ? "text-[var(--danger)]" : ""
                    }`}
                  >
                    {stat.value}
                  </div>
                  <CellSub>{stat.sub}</CellSub>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* ---- Daily volume against the trailing average ---- */}
          <Card className="mt-4">
            <CardHead>
              <CardTitle>Volume today vs the 7-day average</CardTitle>
            </CardHead>
            <CardBody>
              {volume?.anomalous && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--danger)]" />
                  <p className="text-[12.5px] text-[var(--text-2)]">
                    Coin volume is far above the trailing average. Check for a pricing error, a
                    mis-configured rule version, or a single account earning or redeeming at
                    scale.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    label: "Issued (unlocked)",
                    today: volume?.issuedToday ?? 0,
                    avg: volume?.issuedAvg7d ?? 0,
                  },
                  {
                    label: "Redeemed",
                    today: volume?.redeemedToday ?? 0,
                    avg: volume?.redeemedAvg7d ?? 0,
                  },
                ].map((row) => {
                  // A ratio only means something once the average is non-zero;
                  // a new programme divides by zero otherwise.
                  const ratio = row.avg > 0 ? row.today / row.avg : null;
                  return (
                    <div key={row.label} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                        {row.label}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums">
                          {row.today.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[12.5px] text-[var(--text-2)]">
                          vs {row.avg.toLocaleString("en-IN")} avg
                        </span>
                      </div>
                      {ratio !== null && (
                        <div className="mt-1">
                          <Pill tone={ratio >= 3 ? "red" : ratio >= 1.5 ? "amber" : "grey"}>
                            {ratio.toFixed(1)}× average
                          </Pill>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* ---- The control that cannot run without SMS ---- */}
          <Card className="mt-4 border-[var(--warning)]/30">
            <CardHead>
              <CardTitle>Large redemptions — re-verification unavailable</CardTitle>
            </CardHead>
            <CardBody>
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.largeRedemptionsUnverified}
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-2)]">
                    Redemptions in the last 7 days that would have required OTP re-verification
                    under §12.1. Zewa has no SMS provider, so the step-up cannot run — these
                    were allowed through, because refusing them would invent a restriction the
                    specification does not contain. The count is here so the exposure stays
                    visible.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ---- The weekly review list (§12.1) ---- */}
          <Card className="mt-4">
            <CardHead>
              <CardTitle>High-return accounts holding a balance</CardTitle>
            </CardHead>
            {data.highReturnAccounts.length === 0 ? (
              <EmptyState
                title="Nothing to review"
                sub="No account with a recent return is sitting on coins."
              />
            ) : (
              <>
                <CardBody className="pb-0">
                  <p className="text-[13px] text-[var(--text-2)]">
                    The combination is the signal: returning often is ordinary, and holding coins
                    is ordinary — doing both is what §12.1 asks to review weekly.
                  </p>
                </CardBody>
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Customer</Th>
                        <Th align="right">Coins held</Th>
                        <Th align="right">RTOs (90d)</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {data.highReturnAccounts.map((row) => (
                        <Tr key={row.customerId}>
                          <Td>
                            <Link
                              href={`/loyalty/${row.customerId}`}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {row.email}
                            </Link>
                          </Td>
                          <Td align="right" className="tabular-nums font-medium">
                            {row.availableCoins.toLocaleString("en-IN")}
                          </Td>
                          <Td align="right">
                            <Pill tone={exceptionTone(row.rtoCount90d)}>{row.rtoCount90d}</Pill>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </>
            )}
          </Card>
        </>
      ) : null}
    </RoleGate>
  );
}
