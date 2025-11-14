import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../lib/httpError";
import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let registerUser: typeof import("./authService").registerUser;
let loginUser: typeof import("./authService").loginUser;
let refreshTokens: typeof import("./authService").refreshTokens;
let logout: typeof import("./authService").logout;
let getCurrentUser: typeof import("./authService").getCurrentUser;
let expireUserTokens: typeof import("./authService").expireUserTokens;

const baseRegisterInput = {
  email: "owner@kylacafe.ph",
  password: "SecurePassw0rd!",
  profile: {
    businessName: "Kyla Cafe",
    industry: "Food & Beverage",
    fullName: "Kyla Reyes",
    contactNumber: "+63 917 123 4567",
  },
  userAgent: "vitest",
  ipAddress: "127.0.0.1",
};

beforeAll(async () => {
  ({
    registerUser,
    loginUser,
    refreshTokens,
    logout,
    getCurrentUser,
    expireUserTokens,
  } = await import("./authService"));
});

describe("authService", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("registers a user and stores their business profile", async () => {
    const result = await registerUser(baseRegisterInput);

    expect(result.user.email).toBe(baseRegisterInput.email);
    expect(result.user.profile?.businessName).toBe("Kyla Cafe");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("prevents duplicate registrations by email", async () => {
    await registerUser(baseRegisterInput);

    await expect(registerUser(baseRegisterInput)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("logs in a user with valid credentials", async () => {
    await registerUser(baseRegisterInput);

    const result = await loginUser({
      email: baseRegisterInput.email,
      password: baseRegisterInput.password,
      userAgent: "vitest",
      ipAddress: "::1",
    });

    expect(result.user.email).toBe(baseRegisterInput.email);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("rejects login with invalid credentials", async () => {
    await registerUser(baseRegisterInput);

    await expect(
      loginUser({
        email: baseRegisterInput.email,
        password: "WrongPassword!",
        userAgent: "vitest",
        ipAddress: "::1",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rotates refresh tokens and revokes the previous one", async () => {
    const registration = await registerUser(baseRegisterInput);

    const firstRotation = await refreshTokens({
      refreshToken: registration.refreshToken,
      userAgent: "vitest",
      ipAddress: "::1",
    });

    expect(firstRotation.refreshToken).not.toBe(registration.refreshToken);

    await expect(
      refreshTokens({
        refreshToken: registration.refreshToken,
        userAgent: "vitest",
        ipAddress: "::1",
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("revokes a refresh token on logout", async () => {
    const registration = await registerUser(baseRegisterInput);

    await logout({ refreshToken: registration.refreshToken });

    await expect(
      refreshTokens({
        refreshToken: registration.refreshToken,
        userAgent: "vitest",
        ipAddress: "::1",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns the current user profile", async () => {
    const registration = await registerUser(baseRegisterInput);

    const currentUser = await getCurrentUser(registration.user.id);

    expect(currentUser.email).toBe(baseRegisterInput.email);
    expect(currentUser.profile?.businessName).toBe("Kyla Cafe");
  });

  it("expires all outstanding refresh tokens for a user", async () => {
    const registration = await registerUser(baseRegisterInput);
 
    // rotate once to ensure multiple refresh tokens exist
    const rotation = await refreshTokens({
      refreshToken: registration.refreshToken,
      userAgent: "vitest",
      ipAddress: "::1",
    });
 
     await expireUserTokens(registration.user.id);
 
    await expect(
      refreshTokens({
        refreshToken: rotation.refreshToken,
        userAgent: "vitest",
        ipAddress: "::1",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

