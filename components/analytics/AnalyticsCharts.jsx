"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/api";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/** Compact axis label: paise -> "₹1.2k" / "₹45k" / "1.2k" for a plain count. */
function axisLabel(value, isCurrency) {
  const n = isCurrency ? value / 100 : value;
  const abs = Math.abs(n);
  const short =
    abs >= 100000 ? `${(n / 100000).toFixed(1)}L` : abs >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();
  return isCurrency ? `₹${short}` : short;
}

/**
 * Interactive Time-Series Line Chart rendered directly in SVG with CMS design styling.
 * Optionally overlays a `previousData` series (same length/order) for period comparison.
 */
export function TimeSeriesChart({
  data = [],
  previousData = null,
  metric = "grossRevenuePaise",
  isCurrency = true,
  title,
  loading = false,
  className,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (loading) {
    return (
      <Card className={cn("flex h-64 flex-col items-center justify-center gap-2 p-6 text-center", className)}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-soft border-t-navy" />
        <p className="text-[12.5px] text-muted">Loading trend…</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={cn("flex h-64 flex-col items-center justify-center p-6 text-center", className)}>
        <p className="text-[13px] text-muted">No trend data recorded for the selected period.</p>
      </Card>
    );
  }

  const chartWidth = Math.max(data.length * 40, 320);
  const chartHeight = 160;
  const padTop = 10;
  const plotHeight = chartHeight - padTop;

  const values = data.map((d) => d[metric] ?? 0);
  const prevValues = previousData ? previousData.map((d) => d[metric] ?? 0) : [];
  const maxValue = Math.max(...values, ...prevValues, 1);

  const xAt = (i) => (data.length === 1 ? chartWidth / 2 : (i / (data.length - 1)) * chartWidth);
  const yAt = (val) => padTop + plotHeight - (val / maxValue) * plotHeight;

  const linePath = (series) =>
    series.map((val, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(val)}`).join(" ");

  const ticks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));

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
              {previousData?.[hoveredIndex] && (
                <span className="ml-2 text-muted-2">
                  vs {isCurrency
                    ? formatPaise(previousData[hoveredIndex][metric] ?? 0)
                    : (previousData[hoveredIndex][metric] ?? 0).toLocaleString("en-IN")}{" "}
                  prev.
                </span>
              )}
            </div>
          )}
        </CardHead>
      )}

      <div className="p-4">
        <div className="flex gap-2">
          {/* Y-axis */}
          <div
            className="flex shrink-0 flex-col justify-between py-[10px] text-right font-mono text-[10.5px] text-muted-2"
            style={{ height: `${chartHeight}px` }}
          >
            {[...ticks].reverse().map((t, i) => (
              <span key={i}>{axisLabel(t, isCurrency)}</span>
            ))}
          </div>

          <div className="relative h-40 w-full" style={{ height: `${chartHeight}px` }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Grid lines at each tick */}
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={yAt(t)}
                  x2={chartWidth}
                  y2={yAt(t)}
                  stroke="#EEF1F5"
                  strokeWidth="1"
                />
              ))}

              {/* Previous period, dashed */}
              {previousData && previousData.length > 0 && (
                <path
                  d={linePath(prevValues)}
                  fill="none"
                  stroke="#B7C0CC"
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                />
              )}

              {/* Current period */}
              <path d={linePath(values)} fill="none" stroke="#12203D" strokeWidth="2" />

              {/* Hover targets + dots */}
              {data.map((d, i) => (
                <g
                  key={d.date || i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={xAt(i) - chartWidth / data.length / 2}
                    y="0"
                    width={chartWidth / data.length}
                    height={chartHeight}
                    fill="transparent"
                  />
                  <circle
                    cx={xAt(i)}
                    cy={yAt(values[i])}
                    r={hoveredIndex === i ? 4 : 2.5}
                    className={cn("transition-all duration-100", hoveredIndex === i ? "fill-navy" : "fill-navy/70")}
                  />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="mt-2.5 flex justify-between pl-[calc(2.5em+0.5rem)] font-mono text-[11px] text-muted-2">
          <span>{data[0]?.date}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
          <span>{data[data.length - 1]?.date}</span>
        </div>

        {previousData && previousData.length > 0 && (
          <div className="mt-3 flex items-center gap-4 pl-[calc(2.5em+0.5rem)] text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-[2px] w-4 rounded bg-navy" /> Current period
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-0 w-4 border-t-[1.75px] border-dashed"
                style={{ borderColor: "#B7C0CC" }}
              />
              Previous period
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Breakdown Bar List (e.g. for Category, Payment Methods, Order Status).
 */
export function BreakdownBarList({ items = [], title, isCurrency = true, loading = false, className }) {
  if (loading) {
    return (
      <Card className={cn("flex h-48 flex-col items-center justify-center gap-2 p-4 text-center", className)}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-soft border-t-navy" />
        <p className="text-[12px] text-muted">Loading…</p>
      </Card>
    );
  }

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
