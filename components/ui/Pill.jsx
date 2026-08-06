import { cn } from "@/lib/utils";

const TONES = {
  green: "bg-green-wash text-green-deep",
  amber: "bg-amber-wash text-amber-deep",
  red: "bg-red-wash text-red-deep",
  grey: "bg-grey-wash text-grey-deep",
  blue: "bg-blue-wash text-blue-deep",
  teal: "bg-teal-wash text-teal-deep",
  purple: "bg-purple-wash text-purple-deep",
};

/** Status pill with a leading dot (spec §17.2 colour coding). */
export function Pill({ tone = "grey", children, dot = true, className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[2.5px] text-[11.5px] font-medium",
        TONES[tone] || TONES.grey,
        className
      )}
      {...props}
    >
      {dot && <i className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Neutral outlined chip for tags/filters. */
export function Chip({ children, className }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-md border border-line-soft bg-grey-wash px-2 py-0.5 text-[11.5px] text-grey-deep",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Square product/category thumbnail placeholder. */
export function Thumb({ label, color = "#7E8EA4", className }) {
  return (
    <div
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-black/[.06] font-mono text-[11px] font-semibold",
        className
      )}
      style={{ background: `${color}1a`, color }}
    >
      {label}
    </div>
  );
}

/** Star rating, 1–5 (reviews). */
export function Stars({ n = 0 }) {
  return (
    <span className="tracking-[1px] text-[13px] text-amber" aria-label={`${n} out of 5`}>
      {"★★★★★".split("").map((s, i) => (
        <span key={i} className={i < n ? "" : "text-[#D8DEE7]"}>
          ★
        </span>
      ))}
    </span>
  );
}
