"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function TableWrap({ children }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Table({ children }) {
  return <table className="w-full border-collapse">{children}</table>;
}

/**
 * Platform-standard table header cell.
 * If sortable or onSort is provided, renders an accessible sort button indicator.
 */
export function Th({
  children,
  className,
  sortable,
  active,
  dir = "asc",
  sortDirection,
  defaultDir,
  onSort,
  right,
  align,
  ...props
}) {
  const isRight = right || align === "right";
  const isActive = active !== undefined ? active : Boolean(sortDirection);
  const effectiveDir = sortDirection || dir || "asc";
  const isSortable = sortable || Boolean(onSort) || Boolean(sortDirection);
  const colDefaultDir = defaultDir || "asc";

  let sortTitle = "Click to sort";
  if (isActive) {
    const isFirstStep = effectiveDir === colDefaultDir;
    if (isFirstStep) {
      sortTitle =
        effectiveDir === "asc"
          ? "Sorted ascending. Click to sort descending."
          : "Sorted descending. Click to sort ascending.";
    } else {
      sortTitle =
        effectiveDir === "asc"
          ? "Sorted ascending. Click to reset to normal."
          : "Sorted descending. Click to reset to normal.";
    }
  }

  return (
    <th
      onClick={isSortable ? onSort : undefined}
      onKeyDown={
        isSortable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSort?.(e);
              }
            }
          : undefined
      }
      tabIndex={isSortable ? 0 : undefined}
      role={isSortable ? "button" : undefined}
      aria-sort={
        isSortable
          ? isActive
            ? effectiveDir === "asc"
              ? "ascending"
              : "descending"
            : "none"
          : undefined
      }
      title={isSortable ? props.title || sortTitle : props.title}
      className={cn(
        "group whitespace-nowrap border-b border-line-soft bg-card px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-2 transition-colors",
        isRight ? "text-right" : "text-left",
        isSortable &&
          "cursor-pointer select-none hover:bg-canvas/60 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line",
        isActive && "text-ink font-semibold",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          isRight && "flex-row-reverse"
        )}
      >
        <span>{children}</span>
        {isSortable && (
          <span
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded transition-colors shrink-0",
              isActive
                ? "text-ink bg-black/[0.05]"
                : "text-muted-2/40 group-hover:text-muted-2"
            )}
            aria-hidden="true"
          >
            {isActive ? (
              effectiveDir === "asc" ? (
                <ArrowUp size={11} strokeWidth={2.2} />
              ) : (
                <ArrowDown size={11} strokeWidth={2.2} />
              )
            ) : (
              <ArrowUpDown size={11} strokeWidth={1.75} />
            )}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td({ children, className, right, align, ...props }) {
  const isRight = right || align === "right";
  return (
    <td
      className={cn(
        "border-b border-line-soft px-4 py-[11px] align-middle",
        isRight && "text-right",
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

/**
 * Hook to manage sort state and sort an array of data objects.
 * Supports strings (natural comparison), numbers, dates, and custom extractor functions per key.
 */
export function useSortableTable(
  items = [],
  initialConfig = { key: null, dir: "asc" },
  customExtractors = {}
) {
  const initialKey = initialConfig?.key ?? null;
  const initialDir = initialConfig?.direction ?? initialConfig?.dir ?? "asc";

  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const toggleSort = useCallback(
    (key, defaultDir = "asc") => {
      setSortKey((prevKey) => {
        // If clicking a different column: start at defaultDir
        if (prevKey !== key) {
          setSortDir(defaultDir);
          return key;
        }

        // If clicking the same column that is already active:
        // 1st click was defaultDir -> 2nd click flips to opposite
        const oppDir = defaultDir === "asc" ? "desc" : "asc";
        if (sortDir === defaultDir) {
          setSortDir(oppDir);
          return key;
        }

        // 3rd click: reset back to normal (initial order)
        setSortDir(initialDir);
        return initialKey;
      });
    },
    [sortDir, initialKey, initialDir]
  );

  const resetSort = useCallback(() => {
    setSortKey(initialKey);
    setSortDir(initialDir);
  }, [initialKey, initialDir]);

  const clearSort = useCallback(() => {
    setSortKey(null);
    setSortDir("asc");
  }, []);

  const getSortDirection = useCallback(
    (key) => (sortKey === key ? sortDir : null),
    [sortKey, sortDir]
  );

  const sortedItems = useMemo(() => {
    if (!items || !items.length || !sortKey) return items || [];
    const list = [...items];
    const extractor = customExtractors[sortKey] || ((item) => item?.[sortKey]);

    list.sort((a, b) => {
      const valA = extractor(a);
      const valB = extractor(b);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === "") return 1;
      if (valB === null || valB === undefined || valB === "") return -1;

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDir === "desc" ? -comparison : comparison;
    });

    return list;
  }, [items, sortKey, sortDir, customExtractors]);

  return {
    sortedItems,
    items: sortedItems,
    sortKey,
    sortDir,
    sortConfig: { key: sortKey, direction: sortDir },
    isSorted: sortKey !== null && (sortKey !== initialKey || sortDir !== initialDir),
    toggleSort,
    requestSort: toggleSort,
    getSortDirection,
    setSortKey,
    setSortDir,
    resetSort,
    clearSort,
  };
}

