"use client";

import { UserEditor } from "@/components/users/UserEditor";
import { RoleGate } from "@/components/shell/RoleGate";

export default function NewUserPage() {
  return (
    <RoleGate perm="users.manage">
      <UserEditor />
    </RoleGate>
  );
}
