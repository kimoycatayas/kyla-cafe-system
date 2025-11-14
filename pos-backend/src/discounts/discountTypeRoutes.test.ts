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
let accessToken: string;

const baseRegisterPayload = {
  email: "user@discount.test",
  password: "SecurePassw0rd!",
  businessName: "Discount Test",
  industry: "QA",
  fullName: "Discount QA",
  contactNumber: "+63 917 111 1111",
};

beforeAll(async () => {
  ({ default: app } = await import("../app"));
});

describe("discountTypeRoutes", () => {
  beforeEach(() => {
    testPrisma.$reset();
    accessToken = "";
  });

  it("creates and fetches a discount type via HTTP", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send(baseRegisterPayload);
    accessToken = authResponse.body.accessToken;

    const createResponse = await request(app)
      .post("/discount-types")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Senior Citizen",
        type: "PERCENT",
        value: 20,
        scope: "ORDER",
        requiresManagerPin: true,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.discountType.name).toBe("Senior Citizen");

    const listResponse = await request(app)
      .get("/discount-types")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.discountTypes).toHaveLength(1);
  });

  it("updates and deletes a discount type via HTTP", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send({ ...baseRegisterPayload, email: "user2@discount.test" });
    accessToken = authResponse.body.accessToken;

    const createResponse = await request(app)
      .post("/discount-types")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Promo 10",
        type: "PERCENT",
        value: 10,
        scope: "ORDER",
      });

    const discountTypeId = createResponse.body.discountType.id as string;

    const updateResponse = await request(app)
      .patch(`/discount-types/${discountTypeId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ value: 15 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.discountType.value).toBe(15);

    const deleteResponse = await request(app).delete(
      `/discount-types/${discountTypeId}`
    ).set("Authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(204);
  });
});
