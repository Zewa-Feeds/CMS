"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Interactive Time-Series Bar Chart rendered directly in SVG.
 */
export function TimeSeriesChart({
  data = [],
  metric = "grossRevenuePaise",
  isCurrency = true,
  title,
  className,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex h-64 flex-col items-center justify-center rounded-xl border border-line bg-surface p-6 text-center", className)}>
        <p className="text-[13px] text-muted">No trend data available for the selected period.</p>
      </div>
    );
  }

  const values = data.map((d) => d[metric] ?? 0);
  const maxValue = Math.max(...values, 1);
  const chartHeight = 180;
  const barWidthRatio = 0.65;

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div className="text-[12.5px] font-medium text-ink">
              <span className="text-muted">{data[hoveredIndex].date}: </span>
              <span className="font-semibold text-brand">
                {isCurrency
                  ? formatPaise(data[hoveredIndex][metric])
                  : (data[hoveredIndex][metric] ?? 0).toLocaleString("en-IN")}
              </span>
              {data[hoveredIndex].orders !== undefined && (
                <span className="ml-2 text-muted">({data[hoveredIndex].orders} orders)</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative h-48 w-full">
        <svg
          viewBox={`0 0 ${data.length * 40} ${chartHeight}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <line x1="0" y1="0" x2={data.length * 40} y2="0" stroke="#f1f5f9" strokeWidth="1" />
          <line x1="0" y1={chartHeight / 2} x2={data.length * 40} y2={chartHeight / 2} stroke="#f1f5f9" strokeWidth="1" />
          <line x1="0" y1={chartHeight} x2={data.length * 40} y2={chartHeight} stroke="#e2e8f0" strokeWidth="1" />

          {/* Bars */}
          {data.map((d, i) => {
            const val = d[metric] ?? 0;
            const barHeight = Math.max(2, (val / maxValue) * (chartHeight - 15));
            const x = i * 40 + (40 * (1 - barWidthRatio)) / 2;
            const y = chartHeight - barHeight;
            const isHovered = hoveredIndex === i;

            return (
              <g
                key={d.date || i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer transition-all"
              >
                <rect
                  x={x}
                  y={y}
                  width={40 * barWidthRatio}
                  height={barHeight}
                  rx="3"
                  className={cn(
                    "transition-all duration-150",
                    isHovered ? "fill-brand" : "fill-brand-subtle hover:fill-brand"
                  )}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0]?.date}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/**
 * Breakdown Bar List (e.g. for Category, State, Payment Methods).
 */
export function BreakdownBarList({ items = [], title, isCurrency = true, className }) {
  if (!items || items.length === 0) {
    return (
      <div className={cn("flex h-48 flex-col items-center justify-center rounded-xl border border-line bg-surface p-4 text-center", className)}>
        <p className="text-[12.5px] text-muted">No breakdown data available.</p>
      </div>
    );
  }

  const maxValue = Math.max(...items.map((i) => i.value || i.grossPaise || 0), 1);

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", className)}>
      {title && <h3 className="mb-4 text-[15px] font-semibold text-ink">{title}</h3>}
      <div className="space-y-3">
        {items.slice(0, 7).map((item, idx) => {
          const val = item.value ?? item.grossPaise ?? 0;
          const label = item.label ?? item.category ?? item.state ?? item.method ?? "Unknown";
          const pct = Math.round((val / maxValue) * 100);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-ink truncate max-w-[200px]">{label}</span>
                <span className="font-semibold text-ink">
                  {isCurrency ? formatPaise(val) : val.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
