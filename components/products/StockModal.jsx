"use client";

import { useState, useEffect } from "react";
import { useData } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { stockStatus } from "@/lib/utils";
import { Pill } from "@/components/ui/Pill";

const TONE = { "In Stock": "green", "Low Stock": "amber", "Out of Stock": "red" };

/**
 * Stock quick-update from the product list (spec §5.3).
 * Shows every SKU in the family so ops staff can correct them in one pass —
 * the most common daily action.
 */
export function StockModal({ product, onClose, onSaved }) {
  const updateStock = useData((s) => s.updateStock);
  const toast = useToast();
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);

  const variants = product?.variants ?? [];

  useEffect(() => {
    if (variants.length) {
      setVals(Object.fromEntries(variants.map((v) => [v.sku, String(v.stock)])));
    }
  }, [product, variants]);

  if (!product) return null;

  /**
   * One request for the whole family (§5.3).
   *
   * The server writes an audit line per changed SKU in §12.1's before→after
   * format, so no client-side logging is needed — or wanted.
   */
  const save = async () => {
    const invalid = variants.some((v) => {
      const n = parseInt(vals[v.sku], 10);
      return Number.isNaN(n) || n < 0;
    });
    if (invalid) {
      toast.push("Enter a valid stock number for every SKU.", { bad: true });
      return;
    }

    const changed = variants
      .map((v) => ({ sku: v.sku, stock: parseInt(vals[v.sku], 10) }))
      .filter((u, i) => u.stock !== variants[i].stock);

    if (changed.length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      await updateStock(product.slug, changed);
      toast.push(
        changed.length === 1
          ? `Stock updated for ${changed[0].sku}.`
          : `Stock updated for ${changed.length} SKUs.`,
      );
      await onSaved?.();
      onClose();
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const total = variants.reduce((a, v) => a + (parseInt(vals[v.sku], 10) || 0), 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="Update stock"
      sub={product.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? "Updating…" : "Update Stock"}
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <div className="space-y-2.5">
          {variants.map((v, i) => (
            <div key={v.sku} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mono text-[12.5px] font-medium">{v.sku}</div>
                <div className="text-[11.5px] text-muted-2">
                  {v.pack} · currently {v.stock}
                </div>
              </div>
              <Input
                type="number"
                min={0}
                className="w-24 shrink-0 text-right"
                value={vals[v.sku] ?? ""}
                onChange={(e) => setVals((s) => ({ ...s, [v.sku]: e.target.value }))}
                autoFocus={i === 0}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-3 text-[12.5px]">
          <span className="text-muted">New family total</span>
          <span className="mono font-semibold">{total}</span>
          <span className="ml-auto">
            <Pill tone={TONE[stockStatus(total)]}>{stockStatus(total)}</Pill>
          </span>
        </div>
      </div>
    </Modal>
  );
}
