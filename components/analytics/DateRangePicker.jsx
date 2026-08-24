"use client";

import { useState } from "react";
import { Calendar, RefreshCw, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1, offset: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", type: "thisMonth" },
  { label: "Last month", type: "lastMonth" },
  { label: "This year", type: "thisYear" },
];

export function computePresetDates(preset) {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);

  if (preset.days === 0) {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (preset.offset) {
    from.setDate(now.getDate() - preset.offset);
    from.setHours(0, 0, 0, 0);
    to.setDate(now.getDate() - preset.offset);
    to.setHours(23, 59, 59, 999);
  } else if (preset.days) {
    from.setDate(now.getDate() - preset.days);
    from.setHours(0, 0, 0, 0);
  } else if (preset.type === "thisMonth") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (preset.type === "lastMonth") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to.setDate(0); // Last day of previous month
    to.setHours(23, 59, 59, 999);
  } else if (preset.type === "thisYear") {
    from = new Date(now.getFullYear(), 0, 1);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export function DateRangePicker({
  from,
  to,
  compare = true,
  onChange,
  onRefresh,
  onExport,
  loading = false,
  className,
}) {
  const [selectedPreset, setSelectedPreset] = useState("Last 30 days");
  const [customOpen, setCustomOpen] = useState(false);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.label);
    const range = computePresetDates(preset);
    onChange({ ...range, compare });
    setCustomOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-surface px-4 py-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle p-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                selectedPreset === p.label && !customOpen
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen(!customOpen)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              customOpen
                ? "bg-surface font-semibold text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            <Calendar size={12} />
            Custom
          </button>
        </div>

        {customOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-1 px-2 text-[12px]">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setSelectedPreset("Custom");
                onChange({ from: e.target.value, to, compare });
              }}
              className="rounded border border-line-soft px-1.5 py-0.5 text-[12px] text-ink"
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setSelectedPreset("Custom");
                onChange({ from, to: e.target.value, compare });
              }}
              className="rounded border border-line-soft px-1.5 py-0.5 text-[12px] text-ink"
            />
          </div>
        )}

        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted hover:text-ink">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => onChange({ from, to, compare: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-line accent-brand"
          />
          Compare with previous period
        </label>
      </div>

      <div className="flex items-center gap-2">
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="flex items-center gap-1.5 text-[12px]"
          >
            <Download size={13} />
            Export CSV
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-[12px]"
        >
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
