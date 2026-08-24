"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/api";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Interactive Time-Series Bar Chart rendered directly in SVG with CMS design styling.
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
      <Card className={cn("flex h-64 flex-col items-center justify-center p-6 text-center", className)}>
        <p className="text-[13px] text-muted">No trend data recorded for the selected period.</p>
      </Card>
    );
  }

  const values = data.map((d) => d[metric] ?? 0);
  const maxValue = Math.max(...values, 1);
  const chartHeight = 160;
  const barWidthRatio = 0.65;

  return (
    <Card className={className}>
      {title && (
        <CardHead className="justify-between">
          <CardTitle>{title}</CardTitle>
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div className="font-mono text-[12px] text-ink">
              <span className="text-muted">{data[hoveredIndex].date}: </span>
              <span className="font-semibold text-ink">
                {isCurrency
                  ? formatPaise(data[hoveredIndex][metric])
                  : (data[hoveredIndex][metric] ?? 0).toLocaleString("en-IN")}
              </span>
              {data[hoveredIndex].orders !== undefined && (
                <span className="ml-2 text-muted-2">({data[hoveredIndex].orders} orders)</span>
              )}
            </div>
          )}
        </CardHead>
      )}

      <div className="p-4">
        <div className="relative h-44 w-full">
          <svg
            viewBox={`0 0 ${data.length * 40} ${chartHeight}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line x1="0" y1="0" x2={data.length * 40} y2="0" stroke="#EEF1F5" strokeWidth="1" />
            <line x1="0" y1={chartHeight / 2} x2={data.length * 40} y2={chartHeight / 2} stroke="#EEF1F5" strokeWidth="1" />
            <line x1="0" y1={chartHeight} x2={data.length * 40} y2={chartHeight} stroke="#E4E8EE" strokeWidth="1" />

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
                  className="cursor-pointer"
                >
                  <rect
                    x={x}
                    y={y}
                    width={40 * barWidthRatio}
                    height={barHeight}
                    rx="3"
                    className={cn(
                      "transition-colors duration-150",
                      isHovered ? "fill-navy" : "fill-navy/25 hover:fill-navy"
                    )}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* X-axis labels */}
        <div className="mt-2.5 flex justify-between font-mono text-[11px] text-muted-2">
          <span>{data[0]?.date}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Breakdown Bar List (e.g. for Category, Payment Methods, Order Status).
 */
export function BreakdownBarList({ items = [], title, isCurrency = true, className }) {
  if (!items || items.length === 0) {
    return (
      <Card className={cn("flex h-48 flex-col items-center justify-center p-4 text-center", className)}>
        <p className="text-[12.5px] text-muted">No breakdown data available.</p>
      </Card>
    );
  }

  const maxValue = Math.max(...items.map((i) => i.value || i.grossPaise || 0), 1);

  return (
    <Card className={className}>
      {title && (
        <CardHead>
          <CardTitle>{title}</CardTitle>
        </CardHead>
      )}
      <div className="p-4 space-y-3">
        {items.slice(0, 7).map((item, idx) => {
          const val = item.value ?? item.grossPaise ?? 0;
          const label = item.label ?? item.category ?? item.state ?? item.method ?? "Unknown";
          const pct = Math.round((val / maxValue) * 100);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-ink truncate max-w-[220px]">{label}</span>
                <span className="font-mono font-semibold text-ink">
                  {isCurrency ? formatPaise(val) : val.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-line-soft bg-canvas">
                <div
                  className="h-full rounded-full bg-navy transition-all duration-300"
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
