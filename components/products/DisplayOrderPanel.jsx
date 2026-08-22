"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, ChevronUp, ChevronDown, RotateCcw, Save } from "lucide-react";
import { useData } from "@/lib/store";
import { Card, CardHead, CardTitle, CardBody, CardFoot } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { PROD_STATUS_PILL, PRODUCT_STATUS_LABEL } from "@/lib/constants";

/**
 * Catalogue order — the sequence products appear in on the storefront.
 *
 * PRODUCT order. The packs inside a product (ProductVariant.position) and a
 * product's gallery (ProductMedia.position) are separate systems with their own
 * editors, and nothing here touches either.
 *
 * Sits inside the Products screen rather than on a page of its own: sequencing
 * the catalogue is product management, and a separate route would be one more
 * place to remember.
 *
 * DRAG IS NOT THE ONLY WAY TO DO THIS. Native HTML5 drag events are invisible
 * to keyboard and touch users, so every row also carries move-up/move-down
 * buttons operating on the same reducer. That is why there is no drag library
 * here: the buttons are the accessible path and the pointer path is a thin
 * layer over the same two operations.
 */

/** Move `from` to `to`, returning a new array. */
function move(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const sameOrder = (a, b) =>
  a.length === b.length && a.every((row, i) => row.slug === b[i].slug);

export function DisplayOrderPanel({ editable, onClose }) {
  const productDisplayOrder = useData((s) => s.productDisplayOrder);
  const reorderProducts = useData((s) => s.reorderProducts);
  const toast = useToast();

  /** What the server last confirmed. The baseline "dirty" is measured against. */
  const [saved, setSaved] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  /** Row to refocus after a keyboard move, so focus follows the product. */
  const focusSlug = useRef(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await productDisplayOrder();
      setRows(data);
      setSaved(data);
    } catch (err) {
      setLoadError(err?.message || "Could not load the catalogue order.");
    }
  }, [productDisplayOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keyboard moves change the array, so the button the user pressed is now on a
  // different row. Put focus back on the product they were moving.
  useEffect(() => {
    if (!focusSlug.current) return;
    const el = document.querySelector(`[data-order-row="${focusSlug.current}"] [data-focus-me]`);
    focusSlug.current = null;
    el?.focus();
  }, [rows]);

  const dirty = rows && saved && !sameOrder(rows, saved);

  const shift = (index, delta, slug) => {
    focusSlug.current = slug;
    setRows((r) => move(r, index, index + delta));
  };

  const onSave = async () => {
    // Guard the ACTION, not just the button: a double-click can land two calls
    // before React re-renders the disabled state.
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const data = await reorderProducts(rows.map((r) => r.slug));
      setRows(data);
      setSaved(data);
      toast.push("Catalogue order saved — the storefront is updating.");
    } catch (err) {
      /*
       * A 422 here almost always means the catalogue changed underneath this
       * screen. The server's message says so; surfacing it verbatim is more
       * use than a generic failure.
       */
      toast.push(err?.message || "Could not save the order.", { bad: true });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setRows(saved);

  return (
    <Card>
      <CardHead>
        <div className="min-w-0">
          <CardTitle>Product display order</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-muted">
            The order customers see on the shop, category pages and product listings.
            Pack sizes and galleries keep their own order.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <Pill tone="amber">Unsaved</Pill>}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </CardHead>

      <CardBody className="p-0">
        {loadError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-red-deep">{loadError}</p>
            <Button variant="default" size="sm" className="mt-3" onClick={load}>
              <RotateCcw size={14} /> Try again
            </Button>
          </div>
        ) : rows === null ? (
          <ul className="divide-y divide-line-soft" aria-busy="true" aria-label="Loading catalogue order">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4 animate-pulse rounded bg-grey-wash" />
                <div className="h-4 w-7 animate-pulse rounded bg-grey-wash" />
                <div className="h-4 w-48 animate-pulse rounded bg-grey-wash" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">
            There are no products to order yet.
          </p>
        ) : (
          <ol className="divide-y divide-line-soft">
            {rows.map((row, i) => (
              <li
                key={row.slug}
                data-order-row={row.slug}
                draggable={editable && !saving}
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox will not start a drag without data on the transfer.
                  e.dataTransfer.setData("text/plain", row.slug);
                }}
                onDragEnter={() => setOverIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) setRows((r) => move(r, dragIndex, i));
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 sm:px-4",
                  editable && !saving ? "cursor-grab active:cursor-grabbing" : "",
                  dragIndex === i ? "opacity-40" : "",
                  overIndex === i && dragIndex !== null && dragIndex !== i
                    ? "bg-teal-wash"
                    : "hover:bg-[#FBFCFD]",
                ].join(" ")}
              >
                <GripVertical
                  size={15}
                  className={editable ? "shrink-0 text-muted-2" : "shrink-0 text-line"}
                  aria-hidden="true"
                />

                <span className="w-6 shrink-0 text-right text-[12.5px] tabular-nums text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{row.name}</div>
                  <div className="truncate text-[12px] text-muted-2">
                    {row.slug}
                    <span className="mx-1.5 text-line">·</span>
                    {row.category}
                  </div>
                </div>

                <div className="hidden shrink-0 sm:block">
                  {/* The API sends the enum; both the pill tone and the
                      label are keyed on the display name. */}
                  <Pill tone={PROD_STATUS_PILL[PRODUCT_STATUS_LABEL[row.status]] ?? "grey"}>
                    {PRODUCT_STATUS_LABEL[row.status] ?? row.status}
                  </Pill>
                </div>

                {editable && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-focus-me
                      disabled={i === 0 || saving}
                      onClick={() => shift(i, -1, row.slug)}
                      aria-label={`Move ${row.name} up to position ${i}`}
                    >
                      <ChevronUp size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === rows.length - 1 || saving}
                      onClick={() => shift(i, 1, row.slug)}
                      aria-label={`Move ${row.name} down to position ${i + 2}`}
                    >
                      <ChevronDown size={15} />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardBody>

      {editable && rows?.length > 0 && (
        <CardFoot className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-[12px] text-muted-2" role="status">
            {saving
              ? "Saving…"
              : dirty
              ? "Unsaved changes — the storefront still shows the old order."
              : "Saved. This is the order customers see."}
          </p>
          <Button variant="default" size="sm" onClick={reset} disabled={!dirty || saving}>
            <RotateCcw size={14} /> Revert
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving}>
            <Save size={14} /> {saving ? "Saving…" : "Save order"}
          </Button>
        </CardFoot>
      )}
    </Card>
  );
}
