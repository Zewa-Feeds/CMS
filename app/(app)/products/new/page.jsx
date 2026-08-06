"use client";

import { ProductEditor } from "@/components/products/ProductEditor";
import { RoleGate } from "@/components/shell/RoleGate";

export default function NewProductPage() {
  return (
    <RoleGate perm="products.edit">
      <ProductEditor />
    </RoleGate>
  );
}
