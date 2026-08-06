"use client";

import { ChevronUp, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function TableWrap({ children }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Table({ children }) {
  return <table className="w-full border-collapse">{children}</table>;
}

export function Th({ children, className, sortable, active, dir, onSort, right }) {
  return (
    <th
      onClick={sortable ? onSort : undefined}
      className={cn(
        "whitespace-nowrap border-b border-line-soft bg-card px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-2",
        right ? "text-right" : "text-left",
        sortable && "cursor-pointer select-none hover:text-muted",
        active && "text-muted",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-1", right && "flex-row-reverse")}>
        {children}
        {sortable && active && (dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}

export function Td({ children, className, right, ...props }) {
  return (
    <td
      className={cn(
        "border-b border-line-soft px-4 py-[11px] align-middle",
        right && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className, clickable, ...props }) {
  return (
    <tr
      className={cn(
        "[&:last-child>td]:border-b-0",
        clickable && "cursor-pointer hover:bg-[#FBFCFD]",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function CellSub({ children }) {
  return <div className="mt-px text-[11.5px] text-muted-2">{children}</div>;
}

/** Simple pager (spec §3.1). */
export function Pager({ page, pages, total, onPage, unit = "rows" }) {
  if (pages <= 1) return <div className="px-4 py-[11px] text-[12.5px] text-muted">{total} {unit}</div>;
  const nums = Array.from({ length: pages }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-line-soft px-4 py-[11px] text-[12.5px] text-muted">
      <span>{total} {unit}</span>
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={cn(
              "h-7 min-w-[28px] rounded-[7px] border px-2 font-mono text-[12.5px]",
              n === page ? "border-navy bg-navy text-white" : "border-line bg-card hover:bg-canvas"
            )}
          >
            {n}
          </button>
        ))}
        <Button size="sm" variant="ghost" disabled={page === pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** Empty state — an invitation, not a dead end (spec §17.1). */
export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
        <Icon size={20} />
      </div>
      <h3 className="mb-1 text-[15px] font-semibold">{title}</h3>
      {children && <p className="mx-auto mb-4 max-w-[320px] text-[13px] text-muted">{children}</p>}
      {action}
    </div>
  );
}
