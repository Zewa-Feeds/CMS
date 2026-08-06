"use client";

import { CouponEditor } from "@/components/coupons/CouponEditor";
import { RoleGate } from "@/components/shell/RoleGate";

export default function NewCouponPage() {
  return (
    <RoleGate perm="coupons.edit">
      <CouponEditor />
    </RoleGate>
  );
}
