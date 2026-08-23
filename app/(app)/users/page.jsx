"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Power,
  KeyRound,
  Trash2,
  UserCog,
  Mail,
  RotateCw,
  XCircle,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { RoleChangeModal } from "@/components/users/RoleChangeModal";

const ROLE_TONE = {
  ADMIN: "teal",
  OPS_MANAGER: "amber",
  CONTENT_EDITOR: "blue",
  Admin: "teal",
  "Ops Manager": "amber",
  "Content Editor": "blue",
};

export default function UsersPage() {
  const { data, loading, error } = useData((s) => s.users);
  const loadUsers = useData((s) => s.loadUsers);
  const updateUser = useData((s) => s.updateUser);
  const setUserStatus = useData((s) => s.setUserStatus);
  const resendInvitation = useData((s) => s.resendInvitation);
  const revokeInvitation = useData((s) => s.revokeInvitation);
  const deleteUser = useData((s) => s.deleteUser);
  const resetUserPassword = useData((s) => s.resetUserPassword);
  const me = useAuth((s) => s.user);
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [roleModalUser, setRoleModalUser] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState(false);

  const [statusModalUser, setStatusModalUser] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [revokeUser, setRevokeUser] = useState(null);
  const [revokeUpdating, setRevokeUpdating] = useState(false);

  const [resentResult, setResentResult] = useState(null);
  const [copiedResentLink, setCopiedResentLink] = useState(false);

  const [del, setDel] = useState(null);
  const [delText, setDelText] = useState("");

  const refetch = () => loadUsers({ limit: 100 }).catch(() => undefined);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const users = (data ?? []).filter((u) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && u.status !== "ACTIVE") return false;
    if (statusFilter === "INVITED" && u.status !== "INVITED") return false;
    if (statusFilter === "DEACTIVATED" && u.status !== "DEACTIVATED") return false;
    return true;
  });

  const handleRoleChangeConfirm = async (userId, newRole) => {
    setRoleUpdating(true);
    try {
      await updateUser(userId, { role: newRole });
      toast.push("User role updated successfully.");
      setRoleModalUser(null);
      await refetch();
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleStatusToggleConfirm = async () => {
    if (!statusModalUser) return;
    setStatusUpdating(true);
    const isCurrentlyDeactivated = statusModalUser.status === "DEACTIVATED";
    const targetStatus = isCurrentlyDeactivated ? "ACTIVE" : "DEACTIVATED";

    try {
      await setUserStatus(statusModalUser.id, targetStatus);
      toast.push(
        `${statusModalUser.name} ${isCurrentlyDeactivated ? "reactivated" : "disabled"}.`
      );
      setStatusModalUser(null);
      await refetch();
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeUser) return;
    setRevokeUpdating(true);
    try {
      await revokeInvitation(revokeUser.id);
      toast.push(`Invitation for ${revokeUser.email} was revoked.`);
      setRevokeUser(null);
      await refetch();
    } catch (err) {
      toast.push(err.message, { bad: true });
    } finally {
      setRevokeUpdating(false);
    }
  };

  const handleResend = async (user) => {
    try {
      const result = await resendInvitation(user.id);
      setResentResult({ user, inviteUrl: result.inviteUrl });
      toast.push(`Invitation resent to ${user.email}.`);
      await refetch();
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  return (
    <RoleGate perm="users.manage">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "CMS Users" }]} />
      <PageHeader
        title="CMS Users"
        sub="Manage team access, role permissions, and user invitations."
        actions={
          <Link href="/users/new" className={button({ variant: "primary" })}>
            <Plus size={15} /> Add User
          </Link>
        }
      />

      {/* Filter & Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex rounded-lg border border-line bg-surface/50 p-0.5 text-[12.5px]">
            {[
              { key: "ALL", label: "All" },
              { key: "ACTIVE", label: "Active" },
              { key: "INVITED", label: "Pending" },
              { key: "DEACTIVATED", label: "Disabled" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  statusFilter === t.key
                    ? "bg-card text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Role Filter */}
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-auto text-[12.5px]"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="OPS_MANAGER">Ops Manager</option>
            <option value="CONTENT_EDITOR">Content Editor</option>
          </Select>
        </div>
      </div>

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Name — Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>2FA Security</Th>
                <Th>Last Login / Invited</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[13px] text-muted">
                    No users match the selected filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isInvited = u.status === "INVITED";
                  const isDeactivated = u.status === "DEACTIVATED";
                  const isSelf = u.id === me?.id;

                  return (
                    <Tr key={u.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-[11.5px] font-semibold text-teal">
                            {initials(u.name)}
                          </span>
                          <div>
                            <div className="font-medium text-ink">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 text-[11px] font-semibold text-teal-deep">
                                  (you)
                                </span>
                              )}
                            </div>
                            <CellSub>
                              <span className="mono">{u.email}</span>
                            </CellSub>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Pill tone={ROLE_TONE[u.role] || "grey"}>{u.roleLabel || u.role}</Pill>
                      </Td>
                      <Td>
                        {isInvited ? (
                          <Pill tone="amber">Invitation Pending</Pill>
                        ) : isDeactivated ? (
                          <Pill tone="grey">Disabled</Pill>
                        ) : (
                          <Pill tone="green">Active</Pill>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-muted">{u.twofa}</span>
                      </Td>
                      <Td>
                        <span className="mono text-[12.5px] text-muted">
                          {isInvited
                            ? u.invitation?.expiresAt
                              ? `Expires ${new Date(u.invitation.expiresAt).toLocaleDateString("en-IN")}`
                              : "Pending"
                            : u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "— never"}
                        </span>
                      </Td>
                      <Td right>
                        <div className="flex items-center justify-end gap-1">
                          {isInvited ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Resend Invitation"
                                onClick={() => handleResend(u)}
                              >
                                <RotateCw size={14} className="text-teal-deep" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Revoke Invitation"
                                onClick={() => setRevokeUser(u)}
                              >
                                <XCircle size={14} className="text-red-deep" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/users/${u.id}/edit`}
                                className={button({ variant: "ghost", size: "icon-sm" })}
                                title="Edit Profile"
                              >
                                <Pencil size={14} />
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Change Role"
                                disabled={isSelf}
                                onClick={() => setRoleModalUser(u)}
                              >
                                <UserCog size={14} className="text-muted hover:text-ink" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Reset password"
                                onClick={async () => {
                                  try {
                                    await resetUserPassword(u.id);
                                    toast.push(`Password reset issued for ${u.email}.`);
                                  } catch (err) {
                                    toast.push(err.message, { bad: true });
                                  }
                                }}
                              >
                                <KeyRound size={14} className="text-muted" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title={isDeactivated ? "Reactivate User" : "Disable User"}
                                disabled={isSelf}
                                onClick={() => setStatusModalUser(u)}
                              >
                                <Power
                                  size={14}
                                  className={
                                    isDeactivated ? "text-green-deep" : "text-amber-deep"
                                  }
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Delete"
                                disabled={isSelf}
                                onClick={() => setDel(u)}
                              >
                                <Trash2 size={14} className="text-muted" />
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      {/* Role Change Modal */}
      <RoleChangeModal
        open={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        user={roleModalUser}
        onConfirm={handleRoleChangeConfirm}
        loading={roleUpdating}
      />

      {/* Disable / Enable User Confirmation Modal */}
      <ConfirmModal
        open={!!statusModalUser}
        onClose={() => setStatusModalUser(null)}
        title={
          statusModalUser?.status === "DEACTIVATED"
            ? `Reactivate ${statusModalUser?.name}?`
            : `Disable ${statusModalUser?.name}?`
        }
        danger={statusModalUser?.status !== "DEACTIVATED"}
        confirmLabel={
          statusModalUser?.status === "DEACTIVATED" ? "Reactivate User" : "Disable User"
        }
        loading={statusUpdating}
        onConfirm={handleStatusToggleConfirm}
        message={
          statusModalUser && (
            <div>
              {statusModalUser.status === "DEACTIVATED" ? (
                <p className="text-[13px] leading-relaxed text-muted">
                  Reactivating <b>{statusModalUser.name}</b> will restore their ability to sign in
                  and access CMS modules with their assigned role.
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-muted">
                  Disabling <b>{statusModalUser.name}</b> will immediately revoke all active sessions
                  and block their ability to sign in or access protected APIs. Their historical activity
                  and audit records remain intact.
                </p>
              )}
            </div>
          )
        }
      />

      {/* Revoke Invitation Modal */}
      <ConfirmModal
        open={!!revokeUser}
        onClose={() => setRevokeUser(null)}
        title={`Revoke invitation for ${revokeUser?.name}?`}
        danger={true}
        confirmLabel="Revoke Invitation"
        loading={revokeUpdating}
        onConfirm={handleRevokeConfirm}
        message={
          revokeUser && (
            <p className="text-[13px] leading-relaxed text-muted">
              This will invalidate the pending invitation link for <b>{revokeUser.email}</b> immediately.
              They will not be able to activate an account with their current link.
            </p>
          )
        }
      />

      {/* Resent Invitation Modal (with copyable link) */}
      <Modal
        open={!!resentResult}
        onClose={() => {
          setResentResult(null);
          setCopiedResentLink(false);
        }}
        title="Invitation Resent"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setResentResult(null);
              setCopiedResentLink(false);
            }}
          >
            Done
          </Button>
        }
      >
        {resentResult && (
          <div className="space-y-3 py-1">
            <p className="text-[13px] text-muted leading-relaxed">
              A fresh 48-hour invitation email has been queued for <b>{resentResult.user.email}</b>.
              You can also copy the new link directly:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={resentResult.inviteUrl}
                className="mono w-full rounded border border-line bg-surface/70 py-1.5 px-3 text-[12.5px] text-ink font-medium select-all"
              />
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  navigator.clipboard.writeText(resentResult.inviteUrl);
                  setCopiedResentLink(true);
                  toast.push("Invitation link copied!");
                  setTimeout(() => setCopiedResentLink(false), 2000);
                }}
              >
                {copiedResentLink ? (
                  <Check size={14} className="text-teal-deep" />
                ) : (
                  <Copy size={14} />
                )}
                {copiedResentLink ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permanent Delete Modal */}
      <ConfirmModal
        open={!!del}
        onClose={() => {
          setDel(null);
          setDelText("");
        }}
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
              <p className="mb-3 text-[13px] leading-relaxed text-muted">
                This permanently removes <b>{del.name}</b>'s access. Their name stays in the audit
                log against past actions. Consider disabling instead if this may be temporary.
              </p>
              <p className="mb-2 text-[12.5px] text-muted">
                Type <b className="mono">{del.email}</b> to confirm:
              </p>
              <Input
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                autoFocus
              />
            </div>
          )
        }
      />
    </RoleGate>
  );
}
