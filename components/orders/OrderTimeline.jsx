import { Check, X, Circle } from "lucide-react";
import { timeline } from "@/lib/orderFlow";
import { cn } from "@/lib/utils";

/**
 * Step timestamp, e.g. "05 Aug, 11:57 pm".
 *
 * The API sends ISO strings; printing them raw put
 * "2026-08-05T18:27:47.325Z" under the step label — unreadable, and in UTC
 * rather than the reader's timezone.
 */
function stepTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Horizontal lifecycle tracker for the order detail page. */
export function OrderTimeline({ order }) {
  const steps = timeline(order);

  return (
    <div className="flex flex-wrap items-start gap-1">
      {steps.map((s, i) => {
        const done = s.state === "done";
        const current = s.state === "current";
        const cancelled = s.state === "cancelled";
        return (
          <div key={s.label} className="flex min-w-0 flex-1 items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border-2",
                  done && "border-green bg-green text-white",
                  current && "border-teal bg-teal text-teal-ink",
                  cancelled && "border-red bg-red text-white",
                  s.state === "todo" && "border-line bg-card text-muted-2"
                )}
              >
                {done ? (
                  <Check size={14} strokeWidth={3} />
                ) : cancelled ? (
                  <X size={14} strokeWidth={3} />
                ) : (
                  <Circle size={8} fill="currentColor" strokeWidth={0} />
                )}
              </span>
              <span
                className={cn(
                  "mt-1.5 truncate text-[12px] font-medium",
                  s.state === "todo" ? "text-muted-2" : "text-ink"
                )}
              >
                {s.label}
              </span>
              {s.at && (
                <span className="mono truncate text-[10.5px] text-muted-2">{stepTime(s.at)}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mt-[13px] h-0.5 min-w-[16px] flex-1 rounded",
                  steps[i + 1].state === "todo" ? "bg-line" : "bg-green"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
