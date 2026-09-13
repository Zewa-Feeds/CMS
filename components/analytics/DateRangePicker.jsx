"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

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
  showCompare = true,
  onChange,
  onRefresh,
  onExport,
  loading = false,
  className,
  defaultPreset = "Last 30 days",
}) {
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset);
  const [customOpen, setCustomOpen] = useState(false);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.label);
    const range = computePresetDates(preset);
    onChange({ ...range, compare });
    setCustomOpen(false);
  };

  return (
    <Card className={cn("p-3 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-canvas p-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors",
                selectedPreset === p.label && !customOpen
                  ? "bg-navy font-semibold text-white shadow-sm"
                  : "text-muted hover:text-ink hover:bg-card"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen(!customOpen)}
            className={cn(
              "flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors",
              customOpen
                ? "bg-navy font-semibold text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-card"
            )}
          >
            <Calendar size={12} />
            Custom
          </button>
        </div>

        {customOpen && (
          <div className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-[12px]">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setSelectedPreset("Custom");
                onChange({ from: e.target.value, to, compare });
              }}
              className="h-6 rounded border border-line-soft bg-canvas px-1.5 font-mono text-[11.5px] text-ink focus:border-navy focus:outline-none"
            />
            <span className="text-muted-2 text-[11px]">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setSelectedPreset("Custom");
                onChange({ from, to: e.target.value, compare });
              }}
              className="h-6 rounded border border-line-soft bg-canvas px-1.5 font-mono text-[11.5px] text-ink focus:border-navy focus:outline-none"
            />
          </div>
        )}

        {showCompare && (
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted hover:text-ink select-none">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => onChange({ from, to, compare: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-line accent-navy"
            />
            <span>Compare previous period</span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onExport && (
          <Button
            variant="default"
            size="sm"
            onClick={onExport}
            className="flex items-center gap-1.5"
          >
            <Download size={13} />
            Export CSV
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="default"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>
    </Card>
  );
}

/** "01 Aug – 31 Aug 2026", or "All time" when no range is set. */
function formatRangeLabel(from, to) {
  if (!from && !to) return "All time";
  const fmt = (s) => {
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };
  const year = (s) => new Date(`${s}T00:00:00`).getFullYear();
  if (from && to) return `${fmt(from)} – ${fmt(to)}, ${year(to)}`;
  if (from) return `From ${fmt(from)}, ${year(from)}`;
  return `Until ${fmt(to)}, ${year(to)}`;
}

/** "YYYY-MM-DD" -> local Date at midnight, so the calendar highlights the right day regardless of timezone. */
function parseDateStr(s) {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "YYYY-MM-DD", the format every filter/API call in this app expects. */
function toDateStr(d) {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compact date-range control: a single button showing the current range that
 * opens a popover with just a calendar — no presets.
 *
 * Interaction (deliberately not react-day-picker's default range mode):
 *   - Click a date: arms it as the range start, and the range preview follows
 *     the cursor to whatever day is hovered next.
 *   - Click a second date: locks in the range from the first to the second
 *     (whichever order) — the popover stays open so the result is visible.
 *   - Double-click a date: selects that single day as both start and end.
 * The popover only closes on an outside click; there is no auto-close on
 * selection, so the chosen range/preview is always visible to check.
 */
export function DateRangeButton({ from, to, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const ref = useRef(null);

  useClickOutside(ref, () => {
    setOpen(false);
    setRangeStart(null);
    setHoverDate(null);
  });

  const orderRange = (a, b) => (a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a });

  const committedRange = { from: parseDateStr(from), to: parseDateStr(to) };

  // While a start is armed, preview the range out to the hovered day;
  // otherwise just show whatever range is already committed.
  const displayRange = rangeStart
    ? orderRange(rangeStart, hoverDate ?? rangeStart)
    : committedRange;

  const handleDayClick = (day) => {
    if (!rangeStart) {
      setRangeStart(day);
      return;
    }
    const range = orderRange(rangeStart, day);
    onChange({ from: toDateStr(range.from), to: toDateStr(range.to) });
    setRangeStart(null);
    setHoverDate(null);
  };

  const handleDayDoubleClick = (day) => {
    onChange({ from: toDateStr(day), to: toDateStr(day) });
    setRangeStart(null);
    setHoverDate(null);
  };

  const handleClear = () => {
    onChange({ from: undefined, to: undefined });
    setRangeStart(null);
    setHoverDate(null);
  };

  const DayButtonWithHandlers = ({ day, modifiers, ...buttonProps }) => (
    <button
      {...buttonProps}
      onClick={(e) => {
        buttonProps.onClick?.(e);
        handleDayClick(day.date);
      }}
      onDoubleClick={() => handleDayDoubleClick(day.date)}
      onMouseEnter={(e) => {
        buttonProps.onMouseEnter?.(e);
        if (rangeStart) setHoverDate(day.date);
      }}
    />
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button variant="default" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5">
        <Calendar size={14} />
        {formatRangeLabel(from, to)}
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <Card className="absolute right-0 top-[calc(100%+6px)] z-40 w-[300px] p-3">
          <div className="mb-2 flex items-center justify-between border-b border-line-soft pb-2">
            <span className="text-[11.5px] font-medium text-muted">
              {rangeStart ? "Pick an end date, or double-click for one day" : "Click a start date"}
            </span>
            {(from || to) && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>

          <DayPicker
            mode="range"
            numberOfMonths={1}
            selected={displayRange}
            onSelect={() => {}}
            defaultMonth={committedRange.to ?? committedRange.from ?? new Date()}
            showOutsideDays
            components={{
              Chevron: ({ orientation, ...props }) =>
                orientation === "left" ? <ChevronLeft size={16} {...props} /> : <ChevronRight size={16} {...props} />,
              DayButton: DayButtonWithHandlers,
            }}
            className="!m-0 !text-[13px] [--rdp-day-width:32px] [--rdp-day-height:32px] [--rdp-day_button-width:28px] [--rdp-day_button-height:28px] [--rdp-accent-color:#080C18] [--rdp-accent-background-color:#E2FBF5] [--rdp-today-color:#0A7A64]"
          />
        </Card>
      )}
    </div>
  );
}
