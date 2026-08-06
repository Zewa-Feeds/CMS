"use client";

import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";
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
