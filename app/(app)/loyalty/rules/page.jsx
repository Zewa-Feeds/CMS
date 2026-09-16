"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { loyalty as loyaltyApi } from "@/lib/api";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Switch } from "@/components/ui/Field";
import { TableWrap, Table, Th, Td, Tr, CellSub } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Programme configuration — ZSOP004 §8.4 #35, §9.3, §15.1.
 *
 * THE CENTRAL RULE OF THIS SCREEN: saving does not edit anything. It writes a
 * NEW rule version and makes it active. Every order keeps pointing at the
 * version it was priced under, so a rate change today cannot alter what a past
 * order earned or how it unwinds on return. §8.4 #35: "Config is never
 * retroactive."
 *
 * That is why the version history below is not decoration — it is the audit
 * trail for every number the programme has ever run on.
 *
 * The two kill switches (§9.3) take effect within 60 seconds without a
 * deployment. `earningEnabled` is low-impact — existing balances stay usable.
 * `redemptionEnabled` is highly visible and should be treated as a P1 with a
 * comms plan, which is why it carries a warning here rather than sitting as a
 * plain toggle.
 */

const NUMERIC_FIELDS = [
  { key: "earnGranularityPaise", label: "Earn step (paise)", hint: "5000 = 2 coins per ₹100." },
  { key: "coinsPerStep", label: "Coins per step" },
  { key: "coinValuePaise", label: "Coin value (paise)", hint: "100 = 1 coin is ₹1. Critical — changing this revalues every balance." },
  { key: "minRedemptionCoins", label: "Minimum redemption" },
  { key: "maxRedemptionPct", label: "Max % of product value", hint: "100 = no cap." },
  { key: "expiryDays", label: "Expiry (days)", hint: "365. The primary cost lever (§2.3)." },
  { key: "returnWindowDays", label: "Return window (days)" },
  { key: "largeOrderThresholdPaise", label: "Large-order threshold (paise)" },
  { key: "largeOrderHoldDays", label: "Extra hold on large orders (days)" },
  {
    key: "monthlyEarnCapCoins",
    label: "Monthly earning cap (coins)",
    hint: "1000 per customer per calendar month. 0 disables the cap. Individual customers can be given their own cap on their Zewa Coins page.",
  },
];

export default function LoyaltyRulesPage() {
  const [versions, setVersions] = useState([]);
  const [form, setForm] = useState(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loyaltyApi.rules();
      setVersions(rows);
      const activeVersion = rows.find((r) => r.isActive);
      if (activeVersion) {
        setForm(activeVersion);
        // Suggest the next label so the history stays readable.
        const n = rows.length + 1;
        setLabel(`v${n}`);
      }
    } catch (err) {
      setError(err?.message ?? "Could not load the rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!label.trim()) {
      setError("Give the new version a label so the history stays readable.");
      return;
    }

    setSaving(true);
    try {
      const payload = { label: label.trim() };
      for (const f of NUMERIC_FIELDS) payload[f.key] = Number(form[f.key]);
      payload.earningEnabled = form.earningEnabled;
      payload.redemptionEnabled = form.redemptionEnabled;

      await loyaltyApi.updateRules(payload);
      setSaved(true);
      await load();
    } catch (err) {
      setError(err?.message ?? "Could not save the new version.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RoleGate perm="loyalty.config">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Zewa Coins", href: "/loyalty" },
          { label: "Rules" },
        ]}
      />
      <PageHeader
        title="Programme rules"
        sub="Saving creates a new version — past orders keep the rules they were placed under"
      />

      {loading || !form ? (
        <Card>
          <CardBody>Loading…</CardBody>
        </Card>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          {/* ---- Kill switches (§9.3) ---- */}
          <Card>
            <CardHead>
              <CardTitle>Kill switches</CardTitle>
            </CardHead>
            <CardBody className="flex flex-col gap-4">
              <Switch
                checked={form.earningEnabled}
                onChange={(v) => set("earningEnabled", v)}
                label="Earning enabled"
              />
              <p className="-mt-2 text-[12.5px] text-[var(--text-3)]">
                Off stops new issuance; existing balances stay usable. Low customer impact — use
                if issuance logic is found wrong.
              </p>

              <Switch
                checked={form.redemptionEnabled}
                onChange={(v) => set("redemptionEnabled", v)}
                label="Redemption enabled"
              />
              <div className="-mt-2 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-3 py-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                <p className="text-[12.5px] text-[var(--text-2)]">
                  Highly visible to customers. Turning this off removes the coins box from every
                  checkout within 60 seconds. Genuine incidents only — treat as a P1 with a comms
                  plan.
                </p>
              </div>

            </CardBody>
          </Card>

          {/* ---- The numbers ---- */}
          <Card>
            <CardHead>
              <CardTitle>Earning and redemption</CardTitle>
            </CardHead>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {NUMERIC_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint} htmlFor={f.key}>
                    <input
                      id={f.key}
                      type="number"
                      value={form[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* ---- Save as a new version ---- */}
          <Card>
            <CardBody className="flex flex-col gap-3">
              <Field
                label="New version label"
                hint="Saving never edits the current version — it creates this one and activates it."
                required
              >
                <input
                  id="version-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                />
              </Field>

              {error && (
                <p role="alert" className="text-[13px] text-[var(--danger)]">
                  {error}
                </p>
              )}
              {saved && (
                <p className="text-[13px] text-[var(--success)]">
                  New version saved and active. Existing orders are unaffected.
                </p>
              )}

              <div>
                <button type="submit" disabled={saving} className={button({ variant: "primary" })}>
                  {saving ? "Saving…" : "Save as new version"}
                </button>
              </div>
            </CardBody>
          </Card>

          {/* ---- History: the audit trail for every number ever used ---- */}
          <Card>
            <CardHead>
              <CardTitle>Version history</CardTitle>
            </CardHead>
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>Version</Th>
                    <Th align="right">Earn step</Th>
                    <Th align="right">Coin value</Th>
                    <Th align="right">Expiry</Th>
                    <Th>Switches</Th>
                    <Th>Created</Th>
                  </Tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <Tr key={v.id}>
                      <Td>
                        <span className="font-medium">{v.label}</span>
                        {v.isActive && (
                          <span className="ml-2">
                            <Pill tone="green">Active</Pill>
                          </span>
                        )}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {v.earnGranularityPaise}p / {v.coinsPerStep}
                      </Td>
                      <Td align="right" className="tabular-nums">{v.coinValuePaise}p</Td>
                      <Td align="right" className="tabular-nums">{v.expiryDays}d</Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Pill tone={v.earningEnabled ? "green" : "grey"}>
                            Earn {v.earningEnabled ? "on" : "off"}
                          </Pill>
                          <Pill tone={v.redemptionEnabled ? "green" : "grey"}>
                            Redeem {v.redemptionEnabled ? "on" : "off"}
                          </Pill>
                        </div>
                      </Td>
                      <Td className="text-[var(--text-2)]">
                        {new Date(v.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </form>
      )}
    </RoleGate>
  );
}
