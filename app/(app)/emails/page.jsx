"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, Send } from "lucide-react";
import { emails as emailsApi } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Input, Select } from "@/components/ui/Field";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState, Pager } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/**
 * Email log — every send attempt, order-related or not.
 *
 * Exists because of the Sep 2026 ZeptoMail outage. A placeholder token in Render
 * made every send answer 401, and while order mail was logged and resendable, the
 * OTP, password-reset, verification and coin emails wrote no row at all — so the
 * one class of mail that actually failed was the only class nobody could see or
 * replay.
 *
 * The page is built around the question asked during an incident: what did not
 * arrive, and can I send it again now that the cause is fixed.
 */

const STATUS_TONE = {
  SENT: "green",
  QUEUED: "amber",
  FAILED: "red",
  /*
   * Grey, not red. SKIPPED means "there was no provider configured", which is a
   * settings problem rather than a delivery failure — colouring it like an error
   * sends people to investigate the wrong thing, which is exactly what happened
   * during the outage.
   */
  SKIPPED: "grey",
};

const STATUS_LABEL = {
  SENT: "Sent",
  QUEUED: "Queued",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailsPage() {
  const permissions = useAuth((s) => s.permissions);
  const mayResend = permissions.includes("emails.resend");
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [template, setTemplate] = useState("");
  const [search, setSearch] = useState("");
  const [unsentOnly, setUnsentOnly] = useState(false);

  /** Ids ticked for a bulk resend. */
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  /** Row whose stored body is expanded. */
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await emailsApi.list({
        page,
        perPage: 25,
        ...(status ? { status } : {}),
        ...(template ? { template } : {}),
        ...(search ? { search } : {}),
        ...(unsentOnly ? { unsentOnly: true } : {}),
      });
      setRows(res.data ?? []);
      setMeta(res.meta ?? { page: 1, totalPages: 1, total: 0 });
      // Selections are per-view: keeping them across a filter change is how a
      // "resend selected" hits rows the operator can no longer see.
      setSelected(new Set());
    } catch (err) {
      setError(err?.message ?? "Could not load the email log.");
    } finally {
      setLoading(false);
    }
  }, [page, status, template, search, unsentOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    emailsApi
      .templates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  /** Only rows the server says are resendable can be ticked. */
  const selectableRows = rows.filter((r) => r.resendable);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectableRows.length ? new Set() : new Set(selectableRows.map((r) => r.id)),
    );
  }

  async function resendOne(row) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await emailsApi.resend(row.id);
      toast.push(
        res.sent
          ? `Resent to ${row.toEmail}.`
          : `Queued a resend to ${row.toEmail}, but the provider did not accept it.`,
        { bad: !res.sent },
      );
      await load();
    } catch (err) {
      toast.push(err?.message ?? "Could not resend that email.", { bad: true });
    } finally {
      setBusy(false);
    }
  }

  async function resendSelected() {
    if (busy || selected.size === 0) return;
    // Naming the count: the incident shape is a few hundred rows, and "resend
    // everything I filtered" is easy to mean more broadly than intended.
    if (!window.confirm(`Resend ${selected.size} email${selected.size === 1 ? "" : "s"}?`)) return;

    setBusy(true);
    try {
      const res = await emailsApi.resendMany([...selected]);
      toast.push(
        res.failed > 0
          ? `Resent ${res.sent} of ${res.requested}; ${res.failed} could not be sent.`
          : `Resent ${res.sent} email${res.sent === 1 ? "" : "s"}.`,
        { bad: res.failed > 0 },
      );
      await load();
    } catch (err) {
      toast.push(err?.message ?? "The bulk resend failed.", { bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleGate perm="emails.view">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Emails" }]} />
      <PageHeader
        title="Email log"
        sub="Every send attempt, and what became of it"
        actions={
          <div className="flex gap-2">
            {mayResend && selected.size > 0 && (
              <button
                type="button"
                onClick={resendSelected}
                disabled={busy}
                className={button({ variant: "primary" })}
              >
                <Send size={15} />
                {busy ? "Resending…" : `Resend ${selected.size}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={button({ variant: "secondary" })}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search recipient…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="QUEUED">Queued</option>
            </Select>
            <Select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All templates</option>
              {templates.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={unsentOnly}
                onChange={(e) => {
                  setUnsentOnly(e.target.checked);
                  setPage(1);
                }}
              />
              {/* One filter for "did not arrive" — the incident question, which
                  spans failed, skipped and stuck-in-queue alike. */}
              Did not arrive
            </label>
          </div>
        </CardBody>
      </Card>

      {error && (
        <Card className="mb-4 border-[var(--danger)]/30">
          <CardBody>
            <p className="text-[13px] text-[var(--danger)]">{error}</p>
          </CardBody>
        </Card>
      )}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              {mayResend && (
                <Th>
                  <input
                    type="checkbox"
                    aria-label="Select all resendable"
                    checked={selectableRows.length > 0 && selected.size === selectableRows.length}
                    onChange={toggleAll}
                    disabled={selectableRows.length === 0}
                  />
                </Th>
              )}
              <Th>Queued</Th>
              <Th>Template</Th>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
              {mayResend && <Th>{""}</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <Td colSpan={mayResend ? 7 : 5}>
                  <EmptyState icon={Mail} title="No emails match these filters" />
                </Td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <Tr>
                    {mayResend && (
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.subject}`}
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          disabled={!r.resendable}
                          title={r.resendBlockedReason ?? undefined}
                        />
                      </Td>
                    )}
                    <Td>
                      {fmt(r.queuedAt)}
                      {r.isResend && <CellSub>resend</CellSub>}
                    </Td>
                    <Td>{r.template ?? "—"}</Td>
                    <Td>
                      {r.toEmail}
                      {r.customerName && <CellSub>{r.customerName}</CellSub>}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        className="text-left underline decoration-dotted"
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      >
                        {r.subject}
                      </button>
                      {r.orderNo && <CellSub>{r.orderNo}</CellSub>}
                    </Td>
                    <Td>
                      <Pill tone={STATUS_TONE[r.status] ?? "grey"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Pill>
                    </Td>
                    {mayResend && (
                      <Td right>
                        <button
                          type="button"
                          onClick={() => void resendOne(r)}
                          disabled={busy || !r.resendable}
                          title={r.resendBlockedReason ?? undefined}
                          className={button({ variant: "ghost" })}
                        >
                          Resend
                        </button>
                      </Td>
                    )}
                  </Tr>
                  {expanded === r.id && (
                    <tr>
                      <Td colSpan={mayResend ? 7 : 5}>
                        {/* The provider's own words. Before this, that string only
                            existed in the Render logs — putting it on the row is
                            most of the diagnostic value. */}
                        {r.error ? (
                          <p className="text-[12.5px] text-[var(--danger)]">{r.error}</p>
                        ) : (
                          <p className="text-[12.5px] text-[var(--text-3)]">
                            No error recorded.
                            {r.providerMessageId ? ` Provider id ${r.providerMessageId}.` : ""}
                          </p>
                        )}
                        {r.resendBlockedReason && (
                          <p className="mt-1 text-[12.5px] text-[var(--text-3)]">
                            {r.resendBlockedReason}
                          </p>
                        )}
                      </Td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pager
        page={meta.page}
        pages={meta.totalPages}
        total={meta.total}
        onPage={setPage}
        unit="emails"
      />
    </RoleGate>
  );
}
