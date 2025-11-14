import "../test/setupEnv";

import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let app: typeof import("../app").default;

const basePayload = {
  email: "owner@kylacafe.ph",
  password: "SecurePassw0rd!",
  businessName: "Kyla Cafe",
  industry: "Food & Beverage",
  fullName: "Kyla Reyes",
  contactNumber: "+63 917 123 4567",
};

beforeAll(async () => {
  ({ default: app } = await import("../app"));
});

describe("auth routes", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("registers a user", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send(basePayload);

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(basePayload.email);
    expect(response.body.user.profile.businessName).toBe(
      basePayload.businessName
    );
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
  });

  it("requires a business name during registration", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({ email: "missing@business.ph", password: "SecurePassw0rd!" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Business name is required/);
  });

  it("logs in an existing user", async () => {
    await request(app).post("/auth/register").send(basePayload);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: basePayload.email, password: basePayload.password });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(basePayload.email);
  });

  it("refreshes tokens", async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(basePayload);

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.refreshToken).not.toBe(
      registerResponse.body.refreshToken
    );
  });

  it("revokes refresh tokens on logout", async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(basePayload);

    const logoutResponse = await request(app)
      .post("/auth/logout")
      .send({ refreshToken: registerResponse.body.refreshToken });

    expect(logoutResponse.status).toBe(204);

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken });

    expect(refreshResponse.status).toBe(401);
  });

  it("returns the current user profile when authenticated", async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(basePayload);

    const meResponse = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe(basePayload.email);
    expect(meResponse.body.user.profile.businessName).toBe(
      basePayload.businessName
    );
  });

  it("expires the current access token on demand", async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(basePayload);

    const expireResponse = await request(app)
      .post("/auth/expire")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send({ userId: registerResponse.body.user.id });

    expect(expireResponse.status).toBe(200);
    expect(expireResponse.body.message).toMatch(/expired/i);

    const meResponse = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`);

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error).toMatch(/Invalid or expired access token/);
  });
});
