"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Mail } from "lucide-react";
import { emails as emailsApi } from "@/lib/api";
import { Modal, InfoBox } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

/**
 * What was ACTUALLY sent, not a re-render of it.
 *
 * `EmailLog.bodyHtml` is the exact HTML handed to the provider, so a preview of
 * it answers the question the log row cannot: an operator looking at "SENT" has
 * no way to tell whether the customer got the right total, the right address,
 * or — as happened with the staff alerts — a panel of invisible text.
 *
 * It must NOT be re-rendered from the order: the order has moved on since, and
 * a preview built from today's data would show something the customer never
 * received, which is worse than no preview at all.
 */
export function EmailPreviewModal({ open, onClose, email }) {
  // Rows from the order payload already carry bodyHtml; a row from elsewhere
  // may not, so fall back to fetching it by id.
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inlineHtml = email?.bodyHtml ?? null;
  const html = inlineHtml ?? fetched;

  useEffect(() => {
    if (!open || inlineHtml || !email?.id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    emailsApi
      .get(email.id)
      .then((row) => {
        if (!cancelled) setFetched(row?.bodyHtml ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Could not load this email.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, inlineHtml, email?.id]);

  // Drop the previous body when the modal closes, or reopening on a different
  // row would flash the last email's content before the new one arrives.
  useEffect(() => {
    if (!open) {
      setFetched(null);
      setError(null);
    }
  }, [open]);

  if (!email) return null;

  const sentAt = email.sentAt || email.queuedAt;

  /** The stored body in a new tab, for reading at full height. */
  const openInTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // Revoking immediately would race the new tab's load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={email.subject || "Email preview"}
      sub={`to ${email.toEmail || email.to || "—"}${
        sentAt ? ` · ${new Date(sentAt).toLocaleString("en-IN")}` : ""
      }`}
      footer={
        <>
          {html && (
            <Button variant="outline" size="sm" onClick={openInTab}>
              <ExternalLink size={13} className="mr-1.5" />
              Open in new tab
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-2.5 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {email.status && (
            <Pill
              tone={
                email.status === "SENT" || email.status === "DELIVERED"
                  ? "green"
                  : email.status === "FAILED"
                    ? "red"
                    : "amber"
              }
            >
              {email.status}
            </Pill>
          )}
          {email.template && <span className="mono text-[11.5px]">{email.template}</span>}
          <span className="ml-auto text-[11px] text-muted-2">Exactly as sent</span>
        </div>

        {email.error && (
          <div className="flex items-start gap-1.5 rounded-md border border-[#F5D9D6] bg-red-wash px-2.5 py-2 text-[11.5px] text-red-deep">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            <span className="break-all">{email.error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid h-[420px] place-items-center rounded-xl border border-line-soft text-[12.5px] text-muted">
            Loading the sent copy…
          </div>
        ) : error ? (
          <div className="grid h-[420px] place-items-center rounded-xl border border-line-soft px-6 text-center text-[12.5px] text-red-deep">
            {error}
          </div>
        ) : html ? (
          <div className="overflow-hidden rounded-xl border border-line-soft bg-canvas shadow-inner">
            {/*
              No `allow-scripts`: this HTML is replayed from storage and must
              never execute. Without `allow-same-origin` it renders in an opaque
              origin, which is what we want — the frame can paint and nothing
              else.
            */}
            <iframe
              srcDoc={html}
              title={`Preview of ${email.subject ?? "email"}`}
              sandbox=""
              className="h-[460px] w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="pt-1">
            <InfoBox>
              <strong>No stored copy.</strong> This email was sent before the body was
              recorded, so there is nothing to show. Emails sent from now on keep their
              copy and can be previewed here.
            </InfoBox>
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-2">
              <Mail size={12} className="shrink-0" />
              The delivery record above is still accurate.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
