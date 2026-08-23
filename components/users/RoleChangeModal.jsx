"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useAuth } from "@/lib/store";

const ROLE_DETAILS = {
  ADMIN: {
    label: "Admin",
    tone: "teal",
    description: "Full CMS access across all modules, settings, user management, audit logs, and refunds.",
  },
  OPS_MANAGER: {
    label: "Ops Manager",
    tone: "amber",
    description: "Product listings management, SKU pricing/stock, order lifecycle transitions, invoices, and email updates.",
  },
  CONTENT_EDITOR: {
    label: "Content Editor",
    tone: "blue",
    description: "Content creation (blog articles, promotional banners, homepage drafts) and read-only catalogue viewing.",
  },
};

export function RoleChangeModal({ open, onClose, user, onConfirm, loading }) {
  const me = useAuth((s) => s.user);
  const [selectedRole, setSelectedRole] = useState(user?.role || "CONTENT_EDITOR");

  useEffect(() => {
    if (user?.role) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const isSelf = user.id === me?.id;
  const isUnchanged = selectedRole === user.role;
  const currentDetails = ROLE_DETAILS[user.role] || { label: user.role, tone: "grey", description: "" };
  const targetDetails = ROLE_DETAILS[selectedRole] || { label: selectedRole, tone: "grey", description: "" };

  const handleSave = async () => {
    if (isUnchanged || isSelf) return;
    await onConfirm(user.id, selectedRole);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change User Role"
      sub={`Update CMS permissions for ${user.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading || isUnchanged || isSelf}
          >
            {loading ? "Updating Role…" : "Confirm Role Change"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        {isSelf && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber-wash p-3 text-[12.5px] text-amber-deep">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>You cannot modify your own administrative role. Another administrator must make this change.</span>
          </div>
        )}

        <div className="rounded-lg border border-line bg-surface/50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Target Account</div>
          <div className="font-medium text-[13.5px] text-ink">{user.name}</div>
          <div className="text-[12px] mono text-muted">{user.email}</div>
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <span className="text-muted">Current Role:</span>
            <Pill tone={currentDetails.tone}>{currentDetails.label}</Pill>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-ink">Select New Role</label>
          <div className="space-y-2">
            {Object.entries(ROLE_DETAILS).map(([roleKey, details]) => {
              const isSelected = selectedRole === roleKey;
              return (
                <label
                  key={roleKey}
                  onClick={() => !isSelf && setSelectedRole(roleKey)}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-teal bg-teal-wash/40 text-ink"
                      : "border-line bg-card hover:bg-surface/50 text-ink"
                  } ${isSelf ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={roleKey}
                    checked={isSelected}
                    onChange={() => !isSelf && setSelectedRole(roleKey)}
                    disabled={isSelf}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{details.label}</span>
                      <Pill tone={details.tone}>{details.label}</Pill>
                    </div>
                    <p className="mt-1 text-[12px] text-muted leading-relaxed">{details.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {!isUnchanged && !isSelf && (
          <div className="rounded-lg border border-teal/30 bg-teal-wash p-3 text-[12px] text-teal-deep">
            <div className="font-semibold mb-0.5">Role transition:</div>
            <div>
              Changing role from <b>{currentDetails.label}</b> to <b>{targetDetails.label}</b> will immediately update backend permissions and terminate active sessions for this user.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}