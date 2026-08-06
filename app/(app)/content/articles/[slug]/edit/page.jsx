"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store";
import { ArticleEditor } from "@/components/content/ArticleEditor";
import { RoleGate } from "@/components/shell/RoleGate";
import { button } from "@/components/ui/Button";

export default function EditArticlePage() {
  const { slug } = useParams();
  const getArticle = useData((s) => s.getArticle);

  const [article, setArticle] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getArticle(slug);
        if (cancelled) return;
        setArticle(data);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, getArticle]);

  if (state === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading article…</div>;
  }

  if (state === "missing" || !article) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">Article not found</h1>
        <p className="mb-4 text-[13px] text-muted">No article with slug “{slug}”.</p>
        <Link href="/content/articles" className={button({ variant: "dark" })}>
          Back to Articles
        </Link>
      </div>
    );
  }

  return (
    <RoleGate perm="articles.create">
      <ArticleEditor initial={article} />
    </RoleGate>
  );
}

