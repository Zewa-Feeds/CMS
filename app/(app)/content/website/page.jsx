"use client";

import { RoleGate } from "@/components/shell/RoleGate";
import { WebsiteEditor } from "@/components/website/WebsiteEditor";

export default function WebsitePage() {
  return (
    <RoleGate perm="site.edit">
      <WebsiteEditor />
    </RoleGate>
  );
}
