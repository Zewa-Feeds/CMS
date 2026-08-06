"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store";
import { CouponEditor } from "@/components/coupons/CouponEditor";
import { RoleGate } from "@/components/shell/RoleGate";
import { button } from "@/components/ui/Button";

/**
 * Edit a coupon.
 *
 * Fetches the single record by id rather than searching a loaded list, so a deep
 * link or a hard refresh works without visiting the list page first.
 */
export default function EditCouponPage() {
  const { id } = useParams();
  const getCoupon = useData((s) => s.getCoupon);

  const [coupon, setCoupon] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCoupon(id);
        if (cancelled) return;
        setCoupon(data);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getCoupon]);

  if (state === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading coupon…</div>;
  }

  if (state === "missing") {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">Coupon not found</h1>
        <Link href="/coupons" className={button({ variant: "dark" })}>
          Back to Coupons
        </Link>
      </div>
    );
  }

  return (
    <RoleGate perm="coupons.edit">
      <CouponEditor initial={coupon} />
    </RoleGate>
  );
}
