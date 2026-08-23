import { describe, it, expect, vi } from "vitest";
import { users, auth } from "./api";
import { useData } from "./store";

describe("CMS User Management and Invitation API bindings", () => {
  it("exposes resendInvitation and revokeInvitation in users api", () => {
    expect(typeof users.resendInvitation).toBe("function");
    expect(typeof users.revokeInvitation).toBe("function");
  });

  it("exposes invitationDetails and acceptInvitation in auth api", () => {
    expect(typeof auth.invitationDetails).toBe("function");
    expect(typeof auth.acceptInvitation).toBe("function");
  });

  it("exposes resendInvitation and revokeInvitation in useData store", () => {
    const storeState = useData.getState();
    expect(typeof storeState.resendInvitation).toBe("function");
    expect(typeof storeState.revokeInvitation).toBe("function");
    expect(typeof storeState.createUser).toBe("function");
    expect(typeof storeState.updateUser).toBe("function");
    expect(typeof storeState.setUserStatus).toBe("function");
  });
});
