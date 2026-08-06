"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store";
import { UserEditor } from "@/components/users/UserEditor";
import { RoleGate } from "@/components/shell/RoleGate";
import { button } from "@/components/ui/Button";

export default function EditUserPage() {
  const { id } = useParams();
  const getUser = useData((s) => s.getUser);

  const [user, setUser] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getUser(id);
        if (cancelled) return;
        setUser(data);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getUser]);

  if (state === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading user…</div>;
  }

  if (state === "missing" || !user) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">User not found</h1>
        <p className="mb-4 text-[13px] text-muted">No CMS user with ID “{id}”.</p>
        <Link href="/users" className={button({ variant: "dark" })}>
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <RoleGate perm="users.manage">
      <UserEditor initial={user} />
    </RoleGate>
  );
}

