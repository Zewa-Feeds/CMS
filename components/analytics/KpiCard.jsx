"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatPaise } from "@/lib/api";
import { Card } from "@/components/ui/Card";
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

  const formattedValue = isCurrency
    ? formatPaise(current)
    : current.toLocaleString("en-IN");

  const formattedPrev = previous !== undefined && previous !== null
    ? isCurrency
      ? formatPaise(previous)
      : previous.toLocaleString("en-IN")
    : null;

  // Determine trend tone: positive is green, unless invertTone is true (e.g., refunds)
  const isPositive = pctChange !== null && pctChange !== undefined && pctChange > 0;
  const isNegative = pctChange !== null && pctChange !== undefined && pctChange < 0;
  const isNeutral = pctChange === 0 || pctChange === null || pctChange === undefined;

  let toneClasses = "text-grey-deep bg-grey-wash border border-line";
  if (isPositive) {
    toneClasses = invertTone
      ? "text-red-deep bg-red-wash border border-[#F8C8C4]"
      : "text-green-deep bg-green-wash border border-[#B6EAD6]";
  } else if (isNegative) {
    toneClasses = invertTone
      ? "text-green-deep bg-green-wash border border-[#B6EAD6]"
      : "text-red-deep bg-red-wash border border-[#F8C8C4]";
  }

  return (
    <Card className={cn("p-4 flex flex-col justify-between transition-all hover:border-[#CFD6E0]", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted leading-tight">{title}</span>
        {pctChange !== undefined && pctChange !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10.5px] font-medium shrink-0",
              toneClasses
            )}
          >
            {isPositive && <ArrowUpRight size={12} />}
            {isNegative && <ArrowDownRight size={12} />}
            {isNeutral && <Minus size={10} />}
            {Math.abs(pctChange)}%
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <div className="font-mono text-[23px] font-semibold leading-tight tracking-[-.025em] text-ink">
          {formattedValue}
        </div>
        {formattedPrev && (
          <p className="mt-1 text-[11.5px] text-muted truncate">
            vs {formattedPrev} previous period
          </p>
        )}
        {subtext && <p className="mt-1 text-[11.5px] text-muted truncate">{subtext}</p>}
      </div>
    </Card>
  );
}
