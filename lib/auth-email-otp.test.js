import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MARKER = "zewa_cms_session";
const setMarker = () => { document.cookie = `${MARKER}=1; Path=/`; };
const hasMarker = () => document.cookie.split("; ").some((c) => c.startsWith(`${MARKER}=`));
const clearMarker = () => { document.cookie = `${MARKER}=; Path=/; Max-Age=0`; };

const apiLogin = vi.fn();
const apiVerify2fa = vi.fn();
const apiResendOtp = vi.fn();
const apiSetupTotp = vi.fn();
const apiConfirmTotp = vi.fn();

vi.mock("@/lib/api", () => ({
  auth: {
    login: (...a) => apiLogin(...a),
    verifyTwofa: (...a) => apiVerify2fa(...a),
    resendOtp: (...a) => apiResendOtp(...a),
    setupTotp: (...a) => apiSetupTotp(...a),
    confirmTotp: (...a) => apiConfirmTotp(...a),
    restore: vi.fn(),
    logout: vi.fn(),
  },
  session: {
    clear: vi.fn(() => clearMarker()),
    set: vi.fn(() => setMarker()),
    onLost: vi.fn(),
    get exists() { return hasMarker(); },
  },
}));

let useAuth;

beforeEach(async () => {
  vi.resetModules();
  apiLogin.mockReset();
  apiVerify2fa.mockReset();
  apiResendOtp.mockReset();
  apiSetupTotp.mockReset();
  apiConfirmTotp.mockReset();
  clearMarker();
  ({ useAuth } = await import("@/lib/store"));
});

afterEach(() => {
  clearMarker();
});

describe("CMS useAuth store - Email OTP & TOTP fallback", () => {
  it("login() sets status 'twofa', stores maskedEmail and hasTotp flag", async () => {
    apiLogin.mockResolvedValue({
      challengeToken: "chal_token_123",
      twofaEnrolled: true,
      twofaMethod: "EMAIL_OTP",
      hasTotp: false,
      maskedEmail: "ad***@zewafeeds.com",
    });

    const res = await useAuth.getState().login("admin@zewafeeds.com", "password123");

    expect(res.ok).toBe(true);
    expect(res.hasTotp).toBe(false);
    expect(res.maskedEmail).toBe("ad***@zewafeeds.com");

    const state = useAuth.getState();
    expect(state.status).toBe("twofa");
    expect(state.challengeToken).toBe("chal_token_123");
    expect(state.maskedEmail).toBe("ad***@zewafeeds.com");
    expect(state.hasTotp).toBe(false);
  });

  it("resendOtp() invokes api and updates cooldown", async () => {
    useAuth.setState({ challengeToken: "chal_token_123" });
    apiResendOtp.mockResolvedValue({
      ok: true,
      maskedEmail: "ad***@zewafeeds.com",
      cooldownSeconds: 60,
    });

    const res = await useAuth.getState().resendOtp();

    expect(res.ok).toBe(true);
    expect(res.cooldownSeconds).toBe(60);
    expect(apiResendOtp).toHaveBeenCalledWith("chal_token_123");
  });

  it("verify2fa() transitions to 'in' on valid OTP code and clears challengeToken", async () => {
    useAuth.setState({
      status: "twofa",
      challengeToken: "chal_token_123",
      maskedEmail: "ad***@zewafeeds.com",
      hasTotp: false,
    });

    apiVerify2fa.mockResolvedValue({
      accessToken: "access_token_abc",
      user: {
        id: "usr_1",
        email: "admin@zewafeeds.com",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["users.read", "products.edit"],
      },
    });

    const res = await useAuth.getState().verify2fa("654321", true);

    expect(res.ok).toBe(true);
    const state = useAuth.getState();
    expect(state.status).toBe("in");
    expect(state.user.email).toBe("admin@zewafeeds.com");
    expect(state.role).toBe("admin");
    expect(state.challengeToken).toBeNull();
    expect(state.maskedEmail).toBeNull();
  });

  it("setupTotp() and confirmTotp() work seamlessly from profile page", async () => {
    apiSetupTotp.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUrl: "otpauth://totp/CMS:admin@zewafeeds.com?secret=JBSWY3DPEHPK3PXP",
    });

    const setupRes = await useAuth.getState().setupTotp();
    expect(setupRes.ok).toBe(true);
    expect(setupRes.secret).toBe("JBSWY3DPEHPK3PXP");

    apiConfirmTotp.mockResolvedValue({
      ok: true,
      backupCodes: ["CODE1", "CODE2", "CODE3", "CODE4", "CODE5", "CODE6", "CODE7", "CODE8"],
    });

    const confirmRes = await useAuth.getState().confirmTotp("123456");
    expect(confirmRes.ok).toBe(true);
    expect(confirmRes.backupCodes).toHaveLength(8);
  });

  it("propagates rememberMe from login step to verify2fa", async () => {
    apiLogin.mockResolvedValue({
      challengeToken: "chal_token_remember",
      twofaEnrolled: true,
      twofaMethod: "EMAIL_OTP",
      hasTotp: false,
      maskedEmail: "ad***@zewafeeds.com",
    });

    await useAuth.getState().login("admin@zewafeeds.com", "password123", true);
    expect(useAuth.getState().rememberMe).toBe(true);

    apiVerify2fa.mockResolvedValue({
      accessToken: "access_token_remember",
      user: { id: "usr_1", email: "admin@zewafeeds.com", name: "Admin", role: "ADMIN", permissions: [] },
    });

    // Calling verify2fa without explicit remember parameter preserves stored rememberMe: true
    const res = await useAuth.getState().verify2fa("123456");
    expect(res.ok).toBe(true);
    expect(apiVerify2fa).toHaveBeenCalledWith("chal_token_remember", "123456", true);
  });
});
