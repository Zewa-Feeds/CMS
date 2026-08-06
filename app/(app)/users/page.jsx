"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Power, KeyRound, Trash2, UserCog } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

const ROLE_TONE = { Admin: "teal", "Ops Manager": "amber", "Content Editor": "blue" };

export default function UsersPage() {
  const { data, loading, error } = useData((s) => s.users);
  const loadUsers = useData((s) => s.loadUsers);
  const setUserStatus = useData((s) => s.setUserStatus);
  const deleteUser = useData((s) => s.deleteUser);
  const resetUserPassword = useData((s) => s.resetUserPassword);
  const me = useAuth((s) => s.user);
  const toast = useToast();
  const [del, setDel] = useState(null);
  const [delText, setDelText] = useState("");

  const refetch = () => loadUsers({ limit: 100 }).catch(() => undefined);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const users = data ?? [];

  return (
    <RoleGate perm="users.manage">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "CMS Users" }]} />
      <PageHeader
        title="CMS Users"
        sub="Who can access the CMS and what they can do."
        actions={<Link href="/users/new" className={button({ variant: "primary" })}><Plus size={15} /> Add User</Link>}
      />

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Name — Email</Th>
                <Th>Role</Th>
                <Th>Last Login</Th>
                <Th>2FA</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const deactivated = u.status === "DEACTIVATED";
                return (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-[11.5px] font-semibold text-teal">{initials(u.name)}</span>
                        <div>
                          <div className="font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-[11px] text-muted-2">(you)</span>}</div>
                          <CellSub><span className="mono">{u.email}</span></CellSub>
                        </div>
                      </div>
                    </Td>
                    <Td><Pill tone={ROLE_TONE[u.roleLabel]}>{u.roleLabel}</Pill></Td>
                    <Td><span className="mono text-[12.5px]">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "— never"}
                      </span></Td>
                    <Td>
                      <span className="text-[12.5px]">{u.twofa}</span>
                    </Td>
                    <Td><Pill tone={deactivated ? "grey" : "green"}>{deactivated ? "Deactivated" : "Active"}</Pill></Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/users/${u.id}/edit`} className={button({ variant: "ghost", size: "icon-sm" })} title="Edit">
                          <Pencil size={14} />
                        </Link>
                        <Button variant="ghost" size="icon-sm" title="Reset password" onClick={async () => {
                          try {
                            await resetUserPassword(u.id);
                            toast.push(`Password reset issued for ${u.email}.`);
                          } catch (err) {
                            toast.push(err.message, { bad: true });
                          }
                        }}>
                          <KeyRound size={14} className="text-muted" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={deactivated ? "Reactivate" : "Deactivate"}
                          disabled={u.id === me?.id}
                          onClick={async () => {
                            try {
                              // Deactivating revokes every session immediately (§11.3).
                              await setUserStatus(u.id, deactivated ? "ACTIVE" : "DEACTIVATED");
                              toast.push(`${u.name} ${deactivated ? "reactivated" : "deactivated"}.`);
                              await refetch();
                            } catch (err) {
                              toast.push(err.message, { bad: true });
                            }
                          }}
                        >
                          <Power size={14} className={deactivated ? "text-green-deep" : "text-amber-deep"} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Delete" disabled={u.id === me?.id} onClick={() => setDel(u)}>
                          <Trash2 size={14} className="text-muted" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <ConfirmModal
        open={!!del}
        onClose={() => { setDel(null); setDelText(""); }}
        title="Delete this user?"
        confirmLabel="Delete user"
        onConfirm={async () => {
          if (delText !== del.email) {
            toast.push("Type the exact email to confirm.", { bad: true });
            return;
          }
          try {
            await deleteUser(del.id);
            toast.push("User deleted.");
            setDel(null);
            setDelText("");
            await refetch();
          } catch (err) {
            toast.push(err.message, { bad: true });
          }
        }}
        message={
          del && (
            <div>
              <p className="mb-3">
                This permanently removes <b>{del.name}</b>'s access. Their name stays in the audit log
                against past actions. Consider deactivating instead if this may be temporary.
              </p>
              <p className="mb-2 text-[12.5px] text-muted">Type <b className="mono">{del.email}</b> to confirm:</p>
              <Input value={delText} onChange={(e) => setDelText(e.target.value)} autoFocus />
            </div>
          )
        }
      />
    </RoleGate>
  );
}
