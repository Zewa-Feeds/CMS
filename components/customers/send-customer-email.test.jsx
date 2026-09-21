import { describe, expect, it } from "vitest";

describe("SendCustomerEmailModal helpers and audience parsing", () => {
  const parseEmails = (raw) => {
    return raw
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  it("parses comma, newline, and semicolon separated emails correctly", () => {
    const input = "user1@example.com, user2@example.com\nuser3@example.com; user4@example.com";
    const parsed = parseEmails(input);
    expect(parsed).toEqual([
      "user1@example.com",
      "user2@example.com",
      "user3@example.com",
      "user4@example.com",
    ]);
  });

  it("handles empty lines and extra whitespace gracefully", () => {
    const input = "  \n  user@example.com  \n\n  ";
    const parsed = parseEmails(input);
    expect(parsed).toEqual(["user@example.com"]);
  });
});
