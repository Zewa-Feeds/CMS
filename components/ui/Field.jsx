"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Field wrapper: label (+ required *), optional counter, control, hint/error. Spec §17.3 */
export function Field({ label, required, hint, error, counter, htmlFor, className, children }) {
  return (
    <div className={cn("mb-[15px]", className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold">
          {label}
          {required && <span className="text-red-deep"> *</span>}
          {counter != null && (
            <span className="float-right font-mono text-[11px] font-normal text-muted-2">
              {counter}
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-red-deep">
          <AlertCircle size={13} />
          {error}
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-[11.5px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

const baseInput =
  "w-full rounded-md border bg-card px-[11px] py-[8.5px] text-[13.5px] transition-colors hover:border-[#CFD6E0] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-deep";

export const Input = forwardRef(function Input({ className, bad, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        baseInput,
        bad ? "border-red bg-[#FFFBFB]" : "border-line",
        props.readOnly && "cursor-not-allowed bg-grey-wash text-muted",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, bad, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        baseInput,
        "min-h-[92px] resize-y leading-relaxed",
        bad ? "border-red bg-[#FFFBFB]" : "border-line",
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(baseInput, "cms-select cursor-pointer border-line pr-8", className)}
      {...props}
    >
      {children}
    </select>
  );
});

/** iOS-style toggle (spec forms). */
export function Switch({ checked, onChange, label, className }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5", className)}>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-[21px] w-9 rounded-full bg-[#CBD3DE] transition-colors peer-checked:bg-green" />
        <span className="absolute left-[2.5px] top-[2.5px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[15px]" />
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </label>
  );
}

/** Checkbox row with label. */
export function Checkbox({ checked, onChange, label, className }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-[13px]", className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-deep"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Exclusive choice with a description per option.
 *
 * A Select would fit the same data in less space, but hides the options until
 * clicked — wrong for a setting like coupon stacking, where the whole point is
 * that an operator can see the three behaviours side by side and read what each
 * one does before choosing.
 */
export function RadioGroup({ name, value, onChange, options = [], className }) {
  return (
    <div role="radiogroup" className={cn("flex flex-col gap-2", className)}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
              selected
                ? "border-teal-deep bg-[#F2FAFA]"
                : "border-line bg-card hover:border-[#CFD6E0]"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange?.(opt.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal-deep"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{opt.label}</span>
              {opt.hint && (
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                  {opt.hint}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Checkbox dropdown for filtering by several values at once.
 *
 * A native `<select multiple>` renders as an always-open scrolling list box and
 * needs ctrl/cmd-click to add a value, which no one discovers. This keeps the
 * single-select trigger's shape and puts checkboxes in the popover instead.
 *
 * `value` is an array; an EMPTY array means "no filter" (the all-label shows),
 * so the caller never needs a separate "All" sentinel in the list.
 */
export function MultiSelect({
  value = [],
  onChange,
  options = [],
  allLabel = "All",
  className,
  buttonClassName,
  align = "left",
  label,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    // Escape restores the trigger focus: closing a popover should never drop
    // the user back at the top of the page with nothing focused.
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = Array.isArray(value) ? value : [];
  const toggle = (v) =>
    onChange?.(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? // Fall back to the raw value so an unknown one (e.g. a stale URL) is
          // still visible rather than rendering an empty button.
          options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? `${label}: ${summary}` : undefined}
        className={cn(
          baseInput,
          "flex w-full cursor-pointer items-center justify-between gap-2 border-line text-left",
          selected.length > 0 && "border-teal-deep text-ink",
          buttonClassName
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className={cn(
            "absolute top-[calc(100%+4px)] z-40 min-w-full rounded-lg border border-line bg-card p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-[7px] text-[13px] hover:bg-grey-wash"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="h-[15px] w-[15px] shrink-0 accent-teal-deep"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}

          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange?.([])}
              className="mt-1 w-full border-t border-line-soft px-2.5 pb-1 pt-2 text-left text-[12px] font-medium text-teal-deep hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
