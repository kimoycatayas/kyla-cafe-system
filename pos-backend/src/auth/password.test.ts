import "../test/setupEnv";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("StrongPass123!");
    const matches = await verifyPassword("StrongPass123!", hash);

    expect(matches).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("CorrectHorseBatteryStaple");
    const matches = await verifyPassword("WrongPassword!", hash);

    expect(matches).toBe(false);
  });
});

