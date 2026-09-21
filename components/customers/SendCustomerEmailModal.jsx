"use client";

import { useState, useEffect } from "react";
import { Send, Eye, Edit3, Loader2, AlertCircle, Users, Mail } from "lucide-react";
import { Modal, WarnBox, InfoBox } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { customers as customersApi } from "@/lib/api";

/**
 * Modal for composing and dispatching custom or bulk common emails to customers.
 * Includes live HTML preview using Zewa Feeds email branding before sending.
 */
export function SendCustomerEmailModal({
  open,
  onClose,
  initialAudience = "all",
  initialCustomer = null,
  onSent,
}) {
  const toast = useToast();

  const [tab, setTab] = useState("compose"); // "compose" | "preview"
  const [audience, setAudience] = useState(initialCustomer ? "custom" : initialAudience);
  const [customEmailsRaw, setCustomEmailsRaw] = useState(initialCustomer?.email || "");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [message, setMessage] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  // Reset state when opening/closing or changing initialCustomer
  useEffect(() => {
    if (open) {
      setTab("compose");
      setConfirmStep(false);
      if (initialCustomer) {
        setAudience("custom");
        setCustomEmailsRaw(initialCustomer.email || "");
        setHeading(`Hello ${initialCustomer.name || "valued customer"}`);
      } else {
        setAudience(initialAudience);
        setCustomEmailsRaw("");
        setHeading("");
      }
      setSubject("");
      setMessage("");
      setCtaText("");
      setCtaUrl("");
      setPreviewHtml("");
    }
  }, [open, initialCustomer, initialAudience]);

  // Load preview when switching to preview tab
  useEffect(() => {
    if (tab === "preview" && open) {
      void loadPreview();
    }
  }, [tab, open]);

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const data = await customersApi.previewEmail({
        heading: heading.trim() || "Zewa Feeds Announcement",
        message: message.trim() || "Your message body will be styled here with the dark Zewa Feeds brand theme.",
        subject: subject.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        customerName: initialCustomer?.name || "Customer",
      });
      setPreviewHtml(data.html);
    } catch (err) {
      toast.push(err.message || "Failed to generate email preview.", { bad: true });
    } finally {
      setPreviewLoading(false);
    }
  };

  const parseCustomEmails = () => {
    return customEmailsRaw
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  const handleSendClick = (e) => {
    e?.preventDefault?.();
    if (!subject.trim()) {
      toast.push("Subject is required.", { bad: true });
      return;
    }
    if (!heading.trim()) {
      toast.push("Heading is required.", { bad: true });
      return;
    }
    if (!message.trim()) {
      toast.push("Message is required.", { bad: true });
      return;
    }

    if (audience === "custom") {
      const emails = parseCustomEmails();
      if (emails.length === 0) {
        toast.push("Please provide at least one valid recipient email.", { bad: true });
        return;
      }
    }

    // If bulk (all or with_orders), ask for confirmation first
    if ((audience === "all" || audience === "with_orders") && !confirmStep) {
      setConfirmStep(true);
      return;
    }

    void executeSend();
  };

  const executeSend = async () => {
    setSending(true);
    try {
      const customEmails = audience === "custom" ? parseCustomEmails() : undefined;
      const customerIds = initialCustomer?.id ? [initialCustomer.id] : undefined;

      const res = await customersApi.sendEmail({
        audience,
        customerIds,
        customEmails,
        subject: subject.trim(),
        heading: heading.trim(),
        message: message.trim(),
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      });

      toast.push(res.message || "Emails dispatched successfully.");
      onSent?.(res);
      onClose();
    } catch (err) {
      toast.push(err.message || "Failed to send email.", { bad: true });
    } finally {
      setSending(false);
    }
  };

  const audienceLabels = {
    all: "All Active Customers",
    with_orders: "Customers with Orders (Active Buyers)",
    custom: initialCustomer ? `Customer (${initialCustomer.email})` : "Custom Email List",
  };

  return (
    <Modal
      open={open}
      onClose={() => !sending && onClose()}
      title={initialCustomer ? `Send Email to ${initialCustomer.name}` : "Send Customer Email / Broadcast"}
      sub={audienceLabels[audience]}
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1 bg-surface-lowest p-1 rounded-lg border border-line-soft">
            <button
              type="button"
              onClick={() => setTab("compose")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition ${
                tab === "compose"
                  ? "bg-card text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Edit3 size={12} />
              Compose
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition ${
                tab === "preview"
                  ? "bg-card text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Eye size={12} />
              Live Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            {confirmStep ? (
              <Button variant="danger" onClick={executeSend} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={13} className="mr-1.5" />
                    Confirm & Send to {audience === "all" ? "All Customers" : "Buyers"}
                  </>
                )}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSendClick} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={13} className="mr-1.5" />
                    Send Email
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {confirmStep && (
        <div className="mb-4">
          <WarnBox>
            <strong>Confirmation required:</strong> You are about to send this broadcast email to{" "}
            <strong>{audienceLabels[audience]}</strong>. Once sent, emails are delivered immediately to customers.
          </WarnBox>
        </div>
      )}

      {tab === "compose" ? (
        <form onSubmit={handleSendClick} className="space-y-3.5 py-1">
          {!initialCustomer && (
            <Field label="Target Audience">
              <select
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                  setConfirmStep(false);
                }}
                className="w-full rounded-md border border-line-soft bg-card px-3 py-2 text-[13px] outline-none focus:border-teal-deep"
              >
                <option value="all">All Active Customers (Broadcast)</option>
                <option value="with_orders">Customers with Orders (Existing Buyers)</option>
                <option value="custom">Custom Email Addresses List</option>
              </select>
            </Field>
          )}

          {audience === "custom" && !initialCustomer && (
            <Field
              label="Recipient Email Addresses"
              hint="Separate multiple email addresses with commas or new lines"
              required
            >
              <Textarea
                rows={2}
                value={customEmailsRaw}
                onChange={(e) => setCustomEmailsRaw(e.target.value)}
                placeholder="client1@example.com, client2@example.com"
                required
              />
            </Field>
          )}

          <Field label="Subject Line" required>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Update from Zewa Feeds / Special Announcement"
              required
            />
          </Field>

          <Field label="Heading / Title" required>
            <Input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. Important Announcement / New Batch Harvest"
              required
            />
          </Field>

          <Field label="Message Content" hint="Formatted into paragraphs with Zewa Feeds dark styling" required>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your email body text here. Separate paragraphs with empty lines…"
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 border-t border-line-soft">
            <Field label="CTA Button Text (Optional)">
              <Input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="e.g. Shop Now / Read More"
              />
            </Field>
            <Field label="CTA Button URL (Optional)">
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://zewafeeds.com/products"
              />
            </Field>
          </div>
        </form>
      ) : (
        <div className="py-2">
          {previewLoading ? (
            <div className="flex h-64 items-center justify-center text-muted">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Generating branded preview…
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[12px] text-muted flex items-center justify-between px-1">
                <span>
                  Subject: <strong className="text-ink">{subject || heading || "(No subject set)"}</strong>
                </span>
                <span className="text-[11px] text-muted-2">Responsive email preview</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-line-soft bg-canvas shadow-inner">
                <iframe
                  srcDoc={previewHtml}
                  title="Email Preview"
                  className="h-[420px] w-full border-0 bg-transparent"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
