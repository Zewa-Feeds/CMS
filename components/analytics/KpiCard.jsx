"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatPaise } from "@/lib/api";
import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  isCurrency = false,
  delta,
  invertTone = false,
  subtext,
  className,
}) {
  const current = delta?.current ?? (typeof value === "number" ? value : 0);
  const previous = delta?.previous;
  const pctChange = delta?.pctChange;
  const absChange = delta?.absChange;

  const formattedValue = isCurrency
    ? formatPaise(current)
    : current.toLocaleString("en-IN");

  const formattedPrev = previous !== undefined
    ? isCurrency
      ? formatPaise(previous)
      : previous.toLocaleString("en-IN")
    : null;

  // Determine trend tone: positive is usually green, unless invertTone is true (e.g., refunds)
  const isPositive = pctChange !== null && pctChange > 0;
  const isNegative = pctChange !== null && pctChange < 0;
  const isNeutral = pctChange === 0 || pctChange === null;

  let toneColor = "text-muted bg-surface-subtle";
  if (isPositive) {
    toneColor = invertTone
      ? "text-red-700 bg-red-50 border border-red-200"
      : "text-emerald-700 bg-emerald-50 border border-emerald-200";
  } else if (isNegative) {
    toneColor = invertTone
      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
      : "text-red-700 bg-red-50 border border-red-200";
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-line-dark",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{title}</span>
        {pctChange !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
              toneColor
            )}
          >
            {isPositive && <ArrowUpRight size={13} />}
            {isNegative && <ArrowDownRight size={13} />}
            {isNeutral && <Minus size={11} />}
            {pctChange !== null ? `${Math.abs(pctChange)}%` : "—"}
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className="text-[24px] font-bold tracking-tight text-ink">
          {formattedValue}
        </div>
        {formattedPrev && (
          <p className="mt-1 text-[12px] text-muted">
            vs {formattedPrev} previous period
          </p>
        )}
        {subtext && <p className="mt-1 text-[12px] text-muted">{subtext}</p>}
      </div>
    </div>
  );
}
