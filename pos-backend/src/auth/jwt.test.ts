import "../test/setupEnv";

import { describe, expect, it } from "vitest";

import { HttpError } from "../lib/httpError";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";

describe("JWT helpers", () => {
  it("creates and verifies an access token", async () => {
    const token = await signAccessToken({ userId: "user-123", role: "admin" });
    const payload = await verifyAccessToken(token);

    expect(payload.userId).toBe("user-123");
    expect(payload.role).toBe("admin");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("throws for an invalid access token", async () => {
    await expect(verifyAccessToken("invalid-token")).rejects.toBeInstanceOf(HttpError);
  });

  it("creates and verifies a refresh token", async () => {
    const token = await signRefreshToken({
      userId: "user-456",
      tokenId: "token-abc",
    });

    const payload = await verifyRefreshToken(token);

    expect(payload.userId).toBe("user-456");
    expect(payload.tokenId).toBe("token-abc");
  });

  it("throws for an invalid refresh token", async () => {
    await expect(verifyRefreshToken("invalid-token")).rejects.toBeInstanceOf(HttpError);
  });
});

