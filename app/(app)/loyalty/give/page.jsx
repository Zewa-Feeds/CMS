"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Search, X } from "lucide-react";
import { customers as customersApi, loyalty as loyaltyApi } from "@/lib/api";
import { Breadcrumbs, PageHeader, SearchInput } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Give Coins — a credit-only front door onto the existing manual adjustment
 * endpoint (ZSOP004 §9.2).
 *
 * This page adds NO new money-moving path. It posts to the same
 * `POST /loyalty/customers/:id/adjust` that the per-customer support panel uses,
 * so there is exactly one audited route by which coins are created by hand.
 * What it adds is the safe front door for the common case:
 *
 *   CREDIT ONLY. The underlying endpoint accepts a negative `coins` and debits.
 *   That capability stays on the customer page, where the operator has the whole
 *   account in front of them. Here the input is constrained to positive integers,
 *   because "give coins" and "take coins away" deserve different amounts of
 *   friction and a shared form makes the wrong one one keystroke away.
 *
 *   THE CUSTOMER IS SEARCHED, NEVER TYPED. Pasting a UUID is how coins end up on
 *   the wrong account. Search runs server-side over name, email and phone — the
 *   same `GET /customers?q=` the Customers page uses.
 *
 *   ONE IDEMPOTENCY KEY PER SUBMISSION. Generated when the admin opens the
 *   confirmation, not per attempt, so a double-click or a retried request lands
 *   on the ledger's unique index and becomes a no-op rather than a second credit.
 *
 * The balance arithmetic shown here is DISPLAY ONLY. The server recomputes from
 * the ledger inside a locked transaction; this preview exists so the operator can
 * see what they are about to do, not to tell the server anything.
 */

const REASONS = [
  { value: "GOODWILL", label: "Goodwill" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

/** Search results are held locally rather than in the shared customers store,
 *  so opening this page cannot disturb the Customers list someone else is using. */
function useCustomerSearch(term) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setRows([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await customersApi.list({ q, limit: 10 });
        if (!cancelled) setRows(res?.data ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Same idiom as the Customers page: immediate on first use, debounced after.
    if (first.current) {
      first.current = false;
      void run();
      return () => {
        cancelled = true;
      };
    }
    const timer = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return { rows, loading };
}

function GiveCoinsInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get("customerId");

  const [term, setTerm] = useState("");
  const { rows, loading: searching } = useCustomerSearch(term);

  const [selected, setSelected] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [coins, setCoins] = useState("");
  const [reason, setReason] = useState("GOODWILL");
  const [note, setNote] = useState("");

  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  /*
   * One key per submission. Minted when the confirmation opens and cleared only
   * after a success, so every retry of the SAME intent reuses it — that is what
   * makes a double-click a no-op rather than a second credit.
   */
  const idempotencyKey = useRef(null);

  const loadBalance = useCallback(async (customerId) => {
    setBalanceLoading(true);
    try {
      const account = await loyaltyApi.customer(customerId);
      setBalance(account?.availableCoins ?? 0);
    } catch {
      // A customer with no loyalty account yet has no balance — not an error.
      setBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  function pick(customer) {
    setSelected(customer);
    setTerm("");
    setResult(null);
    setFormError("");
    void loadBalance(customer.id);
  }

  function clearSelection() {
    setSelected(null);
    setBalance(null);
    setResult(null);
    setFormError("");
  }

  /*
   * Arriving from a customer's page with `?customerId=` preselects them.
   *
   * Resolved through the same `pick()` the search results use, so the selected
   * panel, the balance fetch and the reset semantics are identical however the
   * customer got here — there is no second selection path to keep in step.
   *
   * Runs once. The admin can still clear the selection and search for someone
   * else; re-running on every render would fight that. With no query parameter
   * nothing here fires and the search workflow is untouched.
   */
  const preselected = useRef(false);
  useEffect(() => {
    if (!presetCustomerId || preselected.current) return;
    preselected.current = true;

    let cancelled = false;
    (async () => {
      try {
        const customer = await customersApi.get(presetCustomerId);
        if (!cancelled && customer) pick(customer);
      } catch {
        // A stale or mistyped id is not an error worth blocking on — the admin
        // simply falls back to searching, which is the ordinary workflow.
        if (!cancelled) setFormError("That customer could not be loaded. Search for them below.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCustomerId]);

  const amount = Number.parseInt(coins, 10);
  const amountValid = Number.isInteger(amount) && amount > 0;
  const noteValid = note.trim().length >= 3 && note.trim().length <= 500;
  const ready = Boolean(selected) && amountValid && noteValid;

  function review(e) {
    e.preventDefault();
    setFormError("");

    if (!selected) return setFormError("Choose a customer first.");
    if (!/^\d+$/.test(coins.trim())) {
      return setFormError("Enter a whole number of coins — no decimals.");
    }
    if (!amountValid) return setFormError("Coins to give must be greater than zero.");
    if (!noteValid) {
      return setFormError("A note of at least 3 characters is required for the audit trail.");
    }

    idempotencyKey.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `give-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setConfirming(true);
  }

  async function give() {
    setSaving(true);
    setFormError("");
    try {
      await loyaltyApi.adjust(
        selected.id,
        {
          coins: amount,
          note: note.trim(),
          reason,
        },
        { idempotencyKey: idempotencyKey.current },
      );

      setConfirming(false);
      toast.push(`${amount} Zewa Coins given to ${fullName(selected)}.`);

      // Re-read the balance rather than trusting the local sum: the server is the
      // authority and may have applied the floor, a cap, or a concurrent movement.
      await loadBalance(selected.id);
      setResult({ coins: amount, customer: selected });

      // The intent is spent — the next submission is a new one.
      idempotencyKey.current = null;
      setCoins("");
      setNote("");
    } catch (err) {
      setConfirming(false);
      // Surface exactly what the server said; no validation rule is duplicated
      // in this client.
      setFormError(err?.message ?? "The coins could not be given.");
      toast.push(err?.message ?? "The coins could not be given.", { bad: true });
    } finally {
      setSaving(false);
    }
  }

  const newBalance = balance != null && amountValid ? balance + amount : null;

  return (
    <RoleGate perm="loyalty.adjust">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Zewa Coins", href: "/loyalty" },
          { label: "Give Coins" },
        ]}
      />
      <PageHeader
        title="Give Zewa Coins"
        sub="Credit a customer's balance by hand — every grant is recorded in the ledger and the audit log"
      />

      <form onSubmit={review} className="flex flex-col gap-4">
        {/* ---- 1. Customer ---- */}
        <Card>
          <CardHead>
            <CardTitle>Customer</CardTitle>
          </CardHead>
          <CardBody className="flex flex-col gap-3">
            {selected ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-teal-deep/30 bg-teal-wash/30 px-3.5 py-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">{fullName(selected)}</div>
                  <div className="mt-0.5 font-mono text-[12px] text-muted">{selected.email}</div>
                  {selected.phone && (
                    <div className="font-mono text-[12px] text-muted">{selected.phone}</div>
                  )}
                  <div className="mt-2 text-[12.5px] text-ink">
                    Current balance:{" "}
                    <span className="font-semibold tabular-nums">
                      {balanceLoading ? "…" : `${(balance ?? 0).toLocaleString("en-IN")} Zewa Coins`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-ink"
                  aria-label="Choose a different customer"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <Field
                  label="Find the customer"
                  hint="Search by name, email or phone. Two characters to start."
                  htmlFor="give-search"
                >
                  <SearchInput
                    id="give-search"
                    placeholder="e.g. Parth, parth@example.com, 98765…"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                </Field>

                {term.trim().length >= 2 && (
                  <div className="rounded-lg border border-line">
                    {searching && rows.length === 0 ? (
                      <div className="px-3.5 py-3 text-[12.5px] text-muted">Searching…</div>
                    ) : rows.length === 0 ? (
                      <div className="px-3.5 py-3 text-[12.5px] text-muted">
                        No customer matches that search.
                      </div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {rows.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => pick(c)}
                              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas"
                            >
                              <span className="min-w-0">
                                <span className="block text-[13px] font-medium text-ink">
                                  {fullName(c)}
                                </span>
                                <span className="block font-mono text-[11.5px] text-muted">
                                  {c.email}
                                  {c.phone ? ` · ${c.phone}` : ""}
                                </span>
                              </span>
                              <Search size={14} className="shrink-0 text-muted" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* ---- 2. The grant ---- */}
        <Card>
          <CardHead>
            <CardTitle>Coins to give</CardTitle>
          </CardHead>
          <CardBody className="flex flex-col gap-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Coins"
                required
                hint="A whole number, greater than zero. This is added to the balance."
                htmlFor="give-coins"
              >
                <Input
                  id="give-coins"
                  inputMode="numeric"
                  value={coins}
                  onChange={(e) => setCoins(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="500"
                  className="tabular-nums"
                />
              </Field>

              <Field label="Reason" required htmlFor="give-reason">
                <Select
                  id="give-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Note"
              required
              hint="The business reason, kept on the ledger entry and the audit log. 3–500 characters."
              counter={`${note.trim().length}/500`}
              htmlFor="give-note"
            >
              <Textarea
                id="give-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Promotional reward for customer"
              />
            </Field>

            {/* ---- Preview: display only ---- */}
            {selected && amountValid && (
              <div className="mt-1 rounded-lg border border-line bg-canvas px-3.5 py-3 text-[12.5px]">
                <div className="flex justify-between text-muted">
                  <span>Current balance</span>
                  <span className="tabular-nums">{(balance ?? 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-1 flex justify-between text-ink">
                  <span>Coins to give</span>
                  <span className="font-semibold tabular-nums text-teal-deep">
                    +{amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
                  <span>New balance</span>
                  <span className="tabular-nums">{newBalance?.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}

            {formError && (
              <p role="alert" className="mt-1 text-[13px] text-red-deep">
                {formError}
              </p>
            )}

            {result && (
              <div className="mt-1 rounded-lg border border-green-deep/30 bg-green-wash px-3.5 py-3 text-[12.5px] text-ink">
                Gave <span className="font-semibold">{result.coins.toLocaleString("en-IN")}</span>{" "}
                Zewa Coins to {fullName(result.customer)}. Their balance is now{" "}
                <span className="font-semibold tabular-nums">
                  {(balance ?? 0).toLocaleString("en-IN")}
                </span>
                .
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={!ready || saving}>
            <Coins size={14} />
            {amountValid ? `Give ${amount.toLocaleString("en-IN")} Zewa Coins` : "Give Zewa Coins"}
          </Button>
          {result && (
            <Button type="button" variant="ghost" onClick={clearSelection}>
              Give coins to another customer
            </Button>
          )}
        </div>
      </form>

      <ConfirmModal
        open={confirming}
        onClose={() => !saving && setConfirming(false)}
        onConfirm={give}
        danger={false}
        loading={saving}
        confirmLabel={`Confirm & give ${amountValid ? amount.toLocaleString("en-IN") : ""} coins`}
        title={
          selected && amountValid
            ? `Give ${amount.toLocaleString("en-IN")} Zewa Coins to ${fullName(selected)}?`
            : "Give Zewa Coins?"
        }
        message={
          selected && amountValid ? (
            <span className="block">
              <span className="block">
                This credits the customer&apos;s account immediately and cannot be undone from
                here — a mistake has to be corrected with a second, opposite adjustment.
              </span>
              <span className="mt-3 block rounded-lg border border-line bg-canvas px-3 py-2.5">
                <span className="flex justify-between">
                  <span className="text-muted">Customer</span>
                  <span className="font-medium">{fullName(selected)}</span>
                </span>
                <span className="mt-1 flex justify-between">
                  <span className="text-muted">Current balance</span>
                  <span className="tabular-nums">{(balance ?? 0).toLocaleString("en-IN")}</span>
                </span>
                <span className="mt-1 flex justify-between">
                  <span className="text-muted">Coins to give</span>
                  <span className="font-semibold tabular-nums text-teal-deep">
                    +{amount.toLocaleString("en-IN")}
                  </span>
                </span>
                <span className="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
                  <span>New balance</span>
                  <span className="tabular-nums">{newBalance?.toLocaleString("en-IN")}</span>
                </span>
                <span className="mt-2 flex justify-between border-t border-line pt-1.5">
                  <span className="text-muted">Reason</span>
                  <span className="font-medium">{reason}</span>
                </span>
                <span className="mt-1 block text-muted">Note: {note.trim()}</span>
              </span>
            </span>
          ) : null
        }
      />
    </RoleGate>
  );
}

/*
 * `useSearchParams` requires a Suspense boundary in a client page, or the
 * production build fails to prerender. Same shape as products/page.jsx.
 */
export default function GiveCoinsPage() {
  return (
    <Suspense fallback={null}>
      <GiveCoinsInner />
    </Suspense>
  );
}

function fullName(c) {
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email;
}
