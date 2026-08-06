"use client";

import { cn } from "@/lib/utils";

/** Underline tabs. tabs = [{ key, label, count? }]. Spec §5.2 / §9. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn("mb-[18px] flex gap-0.5 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-[13px] py-2.5 text-[13px] font-medium transition-colors",
              on
                ? "border-navy text-ink"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn("ml-1.5 font-mono text-[11px]", on ? "text-muted" : "text-muted-2")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
