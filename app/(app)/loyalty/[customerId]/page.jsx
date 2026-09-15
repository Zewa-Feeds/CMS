"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Snowflake } from "lucide-react";
import { loyalty as loyaltyApi } from "@/lib/api";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field } from "@/components/ui/Field";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { useAuth } from "@/lib/store";

/**
 * One customer's coin account — ZSOP004 §9.4.
 *
 * "This is the screen support uses to answer 'why is my balance this number?' —
 * the 60-second test."
 *
 * So everything needed to answer that question is on one page, in the order
 * support asks it: what is the balance now, which lots make it up and when do
 * they expire or unlock, and what moved it. The ledger is shown in full with
 * plain-language reasons, each row linking to its order.
 *
 * Adjustments require a reason and — above the rule version's threshold — a
 * second approver (§9.2). Both are enforced server-side; the form mirrors them
 * so the failure is explained before the request rather than after it.
 */

const REASON_COPY = {
  EARN: "Earned on an order",
  UNLOCK: "Unlocked — return window closed",
  REDEEM: "Used on an order",
  RELEASE: "Hold released — payment not completed",
  EXPIRE: "Expired",
  RESTORE: "Restored after a return",
  CLAWBACK: "Clawed back after a return",
  VOID: "Voided — order not delivered",
  GUEST_CLAIM: "Claimed from a guest order",
  LAUNCH_BACKFILL: "Launch backfill",
  ADJUSTMENT: "Manual adjustment",
  GOODWILL: "Goodwill grant",
  MERGE: "Moved from a merged account",
  RECONCILE: "Balance reconciled to the ledger",
};

const LOT_TONE = {
  AVAILABLE: "green",
  PENDING: "amber",
  REDEEMED: "grey",
  EXPIRED: "grey",
  REVERSED: "red",
  VOID: "red",
};

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function LoyaltyCustomerPage() {
  const { customerId } = useParams();
  /*
   * The SERVER-issued permission list, not a locally derived role — the same
   * source RoleGate uses. Hiding the adjustment form is a courtesy; the endpoint
   * enforces `loyalty.adjust` independently.
   */
  const permissions = useAuth((s) => s.permissions);
  const mayAdjust = permissions.includes("loyalty.adjust");

  const [account, setAccount] = useState(null);
  const [earnCap, setEarnCap] = useState(null);
  const [capCoins, setCapCoins] = useState("");
  const [capReason, setCapReason] = useState("");
  const [capExpires, setCapExpires] = useState("");
  const [capSaving, setCapSaving] = useState(false);
  const [capError, setCapError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Adjustment form
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const [approverId, setApproverId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acc, cap] = await Promise.all([
        loyaltyApi.customer(customerId),
        // Best-effort: a customer with no coin account still has a cap, and a
        // failure here must not blank the ledger support came to read.
        loyaltyApi.earnCap(customerId).catch(() => null),
      ]);
      setAccount(acc);
      setEarnCap(cap);
    } catch (err) {
      setError(err?.message ?? "Could not load this coin account.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAdjustment(e) {
    e.preventDefault();
    setFormError(null);
    const value = Number.parseInt(coins, 10);
    if (!Number.isFinite(value) || value === 0) {
      setFormError("Enter a non-zero number of coins.");
      return;
    }
    if (note.trim().length < 3) {
      // §9.2: "Manual adjustments require a reason code, a free-text note and
      // the admin user ID."
      setFormError("A reason is required on every adjustment.");
      return;
    }

    setSaving(true);
    try {
      await loyaltyApi.adjust(customerId, {
        coins: value,
        note: note.trim(),
        reason: value > 0 ? "GOODWILL" : "ADJUSTMENT",
        ...(approverId.trim() ? { approvedById: approverId.trim() } : {}),
      });
      setCoins("");
      setNote("");
      setApproverId("");
      await load();
    } catch (err) {
      // The server carries the threshold rule, so its message is the accurate
      // one — show it rather than guessing at the limit client-side.
      setFormError(err?.message ?? "The adjustment was not applied.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCap(e) {
    e.preventDefault();
    setCapError(null);
    const value = Number.parseInt(capCoins, 10);
    if (!Number.isFinite(value) || value < 0) {
      setCapError("Enter the monthly cap in coins (0 stops earning entirely).");
      return;
    }
    if (capReason.trim().length < 3) {
      // An override with no stated reason is unauditable, and these are granted
      // in ones and twos by people who will not remember why.
      setCapError("A reason is required on every override.");
      return;
    }

    setCapSaving(true);
    try {
      await loyaltyApi.setEarnCap(customerId, {
        monthlyCapCoins: value,
        reason: capReason.trim(),
        ...(capExpires ? { expiresAt: new Date(capExpires).toISOString() } : {}),
      });
      setCapCoins("");
      setCapReason("");
      setCapExpires("");
      await load();
    } catch (err) {
      setCapError(err?.message ?? "The override was not saved.");
    } finally {
      setCapSaving(false);
    }
  }

  async function clearCap() {
    setCapSaving(true);
    try {
      await loyaltyApi.clearEarnCap(customerId);
      await load();
    } catch (err) {
      setCapError(err?.message ?? "The override was not removed.");
    } finally {
      setCapSaving(false);
    }
  }

  async function freeze() {
    const reason = window.prompt("Why is this account being frozen?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await loyaltyApi.freeze(customerId, reason.trim());
      await load();
    } catch (err) {
      setError(err?.message ?? "Could not freeze the account.");
    }
  }

  if (loading) {
    return (
      <RoleGate perm="loyalty.view">
        <Card>
          <EmptyState title="Loading…" sub="Fetching the coin account." />
        </Card>
      </RoleGate>
    );
  }

  if (error || !account) {
    return (
      <RoleGate perm="loyalty.view">
        <Card>
          <EmptyState
            title={error ? "Could not load" : "No coin account"}
            sub={error ?? "This customer has never earned Zewa Coins."}
          />
        </Card>
      </RoleGate>
    );
  }

  const name =
    `${account.customer.firstName ?? ""} ${account.customer.lastName ?? ""}`.trim() ||
    account.customer.email;

  return (
    <RoleGate perm="loyalty.view">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Zewa Coins", href: "/loyalty" },
          { label: name },
        ]}
      />
      <PageHeader
        title={name}
        sub={account.customer.email}
        actions={
          mayAdjust && account.status === "ACTIVE" ? (
            <button type="button" onClick={freeze} className={button({ variant: "secondary" })}>
              <Snowflake size={15} />
              Freeze
            </button>
          ) : null
        }
      />

      {/* ---- The balance, in the order support is asked about it ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Available", value: account.availableCoins, tone: account.availableCoins < 0 ? "danger" : "text" },
          { label: "Pending", value: account.pendingCoins },
          { label: "Held in carts", value: account.lockedCoins },
          { label: "Lifetime earned", value: account.lifetimeEarned },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                {stat.label}
              </div>
              <div
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  stat.tone === "danger" ? "text-[var(--danger)]" : ""
                }`}
              >
                {stat.value.toLocaleString("en-IN")}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* §6.7: the deficit is surfaced, never silently written off. */}
      {(account.flaggedDeficit > 0 || account.status !== "ACTIVE") && (
        <Card className="mt-4 border-[var(--danger)]/30">
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              {account.status !== "ACTIVE" && <Pill tone="red">{account.status}</Pill>}
              {account.flaggedDeficit > 0 && (
                <Pill tone="amber">Deficit {account.flaggedDeficit} coins</Pill>
              )}
              {account.mismatchStreak >= 2 && (
                <Pill tone="red">Redemption blocked — reconciliation mismatch</Pill>
              )}
              {account.holdout && <Pill tone="grey">Holdout group</Pill>}
            </div>
            {account.flaggedDeficit > 0 && (
              <p className="mt-2 text-[13px] text-[var(--text-2)]">
                A return clawed back more coins than the balance held. The operative balance
                floors at −50; the full shortfall is recorded here and the account is frozen for
                review.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* ---- Lots: what makes up the balance, and when it moves ---- */}
      <Card className="mt-4">
        <CardHead>
          <CardTitle>Coin lots</CardTitle>
        </CardHead>
        {account.lots.length === 0 ? (
          <EmptyState title="No lots" sub="This account has never been granted coins." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>Source</Th>
                  <Th align="right">Granted</Th>
                  <Th align="right">Remaining</Th>
                  <Th>State</Th>
                  <Th>Earned</Th>
                  <Th>Unlocks</Th>
                  <Th>Expires</Th>
                </Tr>
              </thead>
              <tbody>
                {account.lots.map((lot) => (
                  <Tr key={lot.id}>
                    <Td>
                      {lot.sourceType.replace(/_/g, " ").toLowerCase()}
                      {lot.parentLotId && <CellSub>Grace lot</CellSub>}
                    </Td>
                    <Td align="right" className="tabular-nums">{lot.coinsGranted}</Td>
                    <Td align="right" className="tabular-nums font-medium">{lot.coinsRemaining}</Td>
                    <Td>
                      <Pill tone={LOT_TONE[lot.state] ?? "grey"}>{lot.state}</Pill>
                    </Td>
                    <Td className="text-[var(--text-2)]">{fmtDate(lot.earnedAt)}</Td>
                    <Td className="text-[var(--text-2)]">{fmtDate(lot.maturesAt)}</Td>
                    <Td className="text-[var(--text-2)]">{fmtDate(lot.expiresAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* ---- The ledger: the answer to "why is my balance this number?" ---- */}
      <Card className="mt-4">
        <CardHead>
          <CardTitle>Ledger</CardTitle>
        </CardHead>
        {account.ledger.length === 0 ? (
          <EmptyState title="No movements" sub="Nothing has moved on this account yet." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>What happened</Th>
                  <Th align="right">Coins</Th>
                  <Th align="right">Balance after</Th>
                  <Th>Order</Th>
                  <Th>When</Th>
                </Tr>
              </thead>
              <tbody>
                {account.ledger.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      {REASON_COPY[row.reason] ?? row.reason}
                      {row.note && <CellSub>{row.note}</CellSub>}
                    </Td>
                    <Td
                      align="right"
                      className={`tabular-nums font-medium ${
                        row.coinsDelta > 0 ? "text-[var(--success)]" : ""
                      }`}
                    >
                      {row.coinsDelta > 0 ? "+" : ""}
                      {row.coinsDelta}
                    </Td>
                    <Td align="right" className="tabular-nums text-[var(--text-2)]">
                      {row.balanceAfter}
                    </Td>
                    <Td>
                      {row.orderNo ? (
                        <Link
                          href={`/orders/${encodeURIComponent(row.orderNo)}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {row.orderNo}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-3)]">—</span>
                      )}
                    </Td>
                    <Td className="text-[var(--text-2)]">{fmtDate(row.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* ---- Monthly earning cap (§3.3) ---- */}
      {earnCap && (
        <Card className="mt-4">
          <CardHead>
            <CardTitle>Monthly earning cap</CardTitle>
          </CardHead>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                  Effective cap
                </span>
                <div className="text-xl font-semibold tabular-nums">
                  {earnCap.effectiveCapCoins.toLocaleString("en-IN")}
                  <span className="ml-1 text-[13px] font-normal text-[var(--text-2)]">
                    coins / month
                  </span>
                </div>
              </div>
              <div className="text-[13px] text-[var(--text-2)]">
                Programme default: {earnCap.defaultCapCoins.toLocaleString("en-IN")}
                {earnCap.effectiveCapCoins !== earnCap.defaultCapCoins && (
                  <span className="ml-2">
                    <Pill tone="amber">Override active</Pill>
                  </span>
                )}
              </div>
            </div>

            <p className="text-[12.5px] text-[var(--text-2)]">
              Affects earning only — it never changes coins already earned, and never
              touches redemption.
            </p>

            {mayAdjust && (
              <form onSubmit={saveCap} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Monthly cap (coins)" hint="0 stops earning entirely." required>
                    <input
                      id="cap-coins"
                      value={capCoins}
                      onChange={(e) => setCapCoins(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder={String(earnCap.defaultCapCoins)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                  <Field label="Expires" hint="Leave blank for open-ended.">
                    <input
                      id="cap-expires"
                      type="date"
                      value={capExpires}
                      onChange={(e) => setCapExpires(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                  <Field label="Reason" required>
                    <input
                      id="cap-reason"
                      value={capReason}
                      onChange={(e) => setCapReason(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. approved wholesale buyer"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                </div>

                {capError && (
                  <p role="alert" className="text-[13px] text-[var(--danger)]">
                    {capError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button type="submit" disabled={capSaving} className={button({ variant: "primary" })}>
                    {capSaving ? "Saving…" : "Set override"}
                  </button>
                  {earnCap.effectiveCapCoins !== earnCap.defaultCapCoins && (
                    <button
                      type="button"
                      onClick={clearCap}
                      disabled={capSaving}
                      className={button({ variant: "secondary" })}
                    >
                      Back to default
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* History — revoked and expired rows included, because "what was
                this customer allowed, and when" is the audit question. */}
            {earnCap.overrides?.length > 0 && (
              <TableWrap>
                <Table>
                  <thead>
                    <Tr>
                      <Th align="right">Cap</Th>
                      <Th>Reason</Th>
                      <Th>Set by</Th>
                      <Th>Status</Th>
                      <Th>When</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {earnCap.overrides.map((o) => {
                      const expired = o.expiresAt && new Date(o.expiresAt) <= new Date();
                      return (
                        <Tr key={o.id}>
                          <Td align="right" className="tabular-nums">
                            {o.monthlyCapCoins.toLocaleString("en-IN")}
                          </Td>
                          <Td>{o.reason}</Td>
                          <Td className="text-[var(--text-2)]">
                            {o.createdBy?.name ?? o.createdBy?.email ?? "—"}
                          </Td>
                          <Td>
                            {o.revokedAt ? (
                              <Pill tone="grey">Revoked</Pill>
                            ) : expired ? (
                              <Pill tone="grey">Expired</Pill>
                            ) : (
                              <Pill tone="green">Active</Pill>
                            )}
                          </Td>
                          <Td className="text-[var(--text-2)]">
                            {fmtDate(o.createdAt)}
                            {o.expiresAt && <CellSub>until {fmtDate(o.expiresAt)}</CellSub>}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>
      )}

      {/* ---- Manual adjustment (§9.2) ---- */}
      {mayAdjust && (
        <Card className="mt-4">
          <CardHead>
            <CardTitle>Adjust balance</CardTitle>
          </CardHead>
          <CardBody>
            <form onSubmit={submitAdjustment} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Coins" hint="Positive to credit, negative to debit." required>
                  <input
                    id="adjust-coins"
                    value={coins}
                    onChange={(e) => setCoins(e.target.value.replace(/[^0-9-]/g, ""))}
                    inputMode="numeric"
                    placeholder="e.g. 50 or -25"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
                <Field
                  label="Second approver (admin ID)"
                  hint="Required above the approval threshold."
                >
                  <input
                    id="adjust-approver"
                    value={approverId}
                    onChange={(e) => setApproverId(e.target.value)}
                    placeholder="Leave blank for small adjustments"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
              </div>

              <Field label="Reason" hint="Recorded in the ledger and shown to the customer." required>
                <input
                  id="adjust-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="Why is this adjustment being made?"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                />
              </Field>

              {formError && (
                <p role="alert" className="text-[13px] text-[var(--danger)]">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button type="submit" disabled={saving} className={button({ variant: "primary" })}>
                  {saving ? "Applying…" : "Apply adjustment"}
                </button>
                <span className="text-[12px] text-[var(--text-3)]">
                  Corrections are new ledger entries — nothing is ever edited or deleted.
                </span>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </RoleGate>
  );
}
