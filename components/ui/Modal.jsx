"use client";

import { useEffect } from "react";
import { X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/** Modal dialog with scrim. Spec §3.1 / §17.1. */
export function Modal({ open, onClose, title, sub, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-navy/50 p-5"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "m-auto w-full animate-modal-in rounded-xl bg-card shadow-pop",
          wide ? "max-w-[620px]" : "max-w-[460px]"
        )}
      >
        <div className="flex items-start gap-3 px-[18px] pb-3 pt-4">
          <div>
            <h3 className="text-[15.5px] font-semibold tracking-[-.01em]">{title}</h3>
            {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1 text-muted-2 hover:bg-grey-wash hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-[18px] pb-1">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 px-[18px] pb-4 pt-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function WarnBox({ children }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-[#F5D9D6] bg-red-wash px-3 py-[11px] text-[12.5px] leading-snug text-red-deep">
      <AlertTriangle size={16} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function InfoBox({ children }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-[#D5E5FC] bg-blue-wash px-3 py-[11px] text-[12.5px] leading-snug text-blue-deep">
      <Info size={16} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Confirmation dialog for destructive actions (spec §17.1). */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="pb-2 text-[13px] leading-relaxed text-ink">{message}</div>
    </Modal>
  );
}
