"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Check, X } from "lucide-react";
import { useData } from "@/lib/store";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { catColor } from "@/lib/constants";

/**
 * Product picker for product-specific coupons (§10.2 extension).
 *
 * Opens a searchable checkbox list of product families. Selection is held locally
 * and only committed on OK, so Cancel genuinely discards — a coupon's scope is
 * consequential enough that an accidental toggle should not stick.
 *
 * Families, not variants: a coupon applies to a product, and its pack sizes come
 * along with it.
 */
export function ProductPicker({ open, onClose, selectedIds = [], onConfirm }) {
  const loadProducts = useData((s) => s.loadProducts);
  const { data, loading } = useData((s) => s.products);

  const [picked, setPicked] = useState(new Set(selectedIds));
  const [q, setQ] = useState("");

  // Reset to the incoming selection each time the dialog opens, so a previous
  // Cancel does not leak into the next open.
  useEffect(() => {
    if (open) {
      setPicked(new Set(selectedIds));
      setQ("");
      void loadProducts({ limit: 100 }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const products = data ?? [];

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term),
    );
  }, [products, q]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected = rows.length > 0 && rows.every((p) => picked.has(p.id));

  const toggleAllVisible = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((p) => next.delete(p.id));
      else rows.forEach((p) => next.add(p.id));
      return next;
    });

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Choose products"
      sub="The coupon will only discount these products."
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-muted">
            {picked.size} selected
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm([...picked])}
            disabled={picked.size === 0}
          >
            <Check size={14} /> OK
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            autoFocus
            className="w-full rounded-md border border-line bg-canvas py-2 pl-9 pr-3 text-[13px] placeholder:text-muted-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-deep"
          />
        </div>
        {rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAllVisible}>
            {allVisibleSelected ? "Clear all" : "Select all"}
          </Button>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto rounded-lg border border-line">
        {loading && products.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted">Loading products…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted">
            {q ? `No products match “${q}”.` : "No products in the catalogue yet."}
          </div>
        ) : (
          rows.map((p) => {
            const on = picked.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-left last:border-b-0 hover:bg-canvas"
              >
                <span
                  className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded border ${
                    on ? "border-teal-deep bg-teal-deep" : "border-line bg-card"
                  }`}
                >
                  {on && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: catColor(p.cat) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="mono block truncate text-[11.5px] text-muted-2">
                    {p.slug} · {p.variantCount} SKU{p.variantCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] text-muted-2">{p.statusLabel}</span>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}

/**
 * Read-only summary of the chosen products, shown on the coupon form.
 * Each chip can be removed inline so a small correction needs no dialog.
 */
export function SelectedProducts({ products = [], onRemove }) {
  if (products.length === 0) {
    return (
      <p className="text-[12.5px] text-amber-deep">
        No products selected — this coupon would not apply to anything.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {products.map((p) => (
        <span
          key={p.id}
          className="flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-2.5 pr-1.5 text-[12px]"
        >
          {p.name}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label={`Remove ${p.name}`}
              className="grid h-4 w-4 place-items-center rounded-full text-muted-2 hover:bg-red-wash hover:text-red-deep"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
