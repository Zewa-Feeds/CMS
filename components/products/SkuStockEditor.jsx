"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useData } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { sanitizeStockInput } from "@/lib/utils";
import { Input } from "@/components/ui/Field";

/**
 * Inline stock quantity for one SKU row on the Products → SKUs tab.
 *
 * Same write as the Update stock window: PATCH /products/:slug/stock, which
 * sets the live count immediately (outside draft/publish) and writes one
 * audit line per changed SKU. Only this SKU is sent, so the rest of the
 * family is never touched.
 *
 * Enter or ✓ saves; Escape or ✕ puts the current value back.
 */
export function SkuStockEditor({ slug, sku, stock, onSaved }) {
  const updateStock = useData((s) => s.updateStock);
  const toast = useToast();
  const [val, setVal] = useState(String(stock));
  const [busy, setBusy] = useState(false);

  // A refetch after any save (this row or another) brings the live value in.
  useEffect(() => {
    setVal(String(stock));
  }, [stock]);

  const dirty = val !== String(stock);

  const reset = () => setVal(String(stock));

  const save = async () => {
    if (!dirty || busy) return;
    const n = val === "" ? NaN : parseInt(val, 10);
    if (!Number.isInteger(n) || n < 0) {
      toast.push(`Enter a whole number of 0 or more for ${sku}.`, { bad: true });
      return;
    }
    setBusy(true);
    try {
      await updateStock(slug, [{ sku, stock: n }]);
      toast.push(`Stock for ${sku} set to ${n}.`);
      await onSaved?.();
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={`Stock for ${sku}`}
        className="!py-1.5 w-20 text-right tabular-nums"
        value={val}
        disabled={busy}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setVal(sanitizeStockInput(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") reset();
        }}
      />
      {dirty && (
        <>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            aria-label={`Save stock for ${sku}`}
            title="Save"
            className="rounded-[7px] p-[5px] text-green-deep hover:bg-green-wash disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            aria-label={`Cancel stock change for ${sku}`}
            title="Cancel"
            className="rounded-[7px] p-[5px] text-muted hover:bg-black/5 disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </>
      )}
    </div>
  );
}
