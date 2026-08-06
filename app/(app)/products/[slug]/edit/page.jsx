"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store";
import { ProductEditor } from "@/components/products/ProductEditor";
import { RoleGate } from "@/components/shell/RoleGate";
import { button } from "@/components/ui/Button";

export default function EditProductPage() {
  const { slug } = useParams();
  const getProduct = useData((s) => s.getProduct);

  const [product, setProduct] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProduct(slug);
        if (cancelled) return;
        setProduct(data);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, getProduct]);

  if (state === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading product…</div>;
  }

  if (state === "missing" || !product) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">Product not found</h1>
        <p className="mb-5 text-[13px] text-muted">No product with slug “{slug}”.</p>
        <Link href="/products" className={button({ variant: "dark" })}>
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <RoleGate perm="products.view">
      <ProductEditor initial={product} />
    </RoleGate>
  );
}

