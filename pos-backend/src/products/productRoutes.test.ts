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

const basePayload = {
  name: "Spanish Latte 16 oz",
  sku: "BEV-SL-016",
  price: 165,
  cost: 82,
  barcode: "4801234567891",
};

const registerPayload = {
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

describe("product routes", () => {
  beforeEach(async () => {
    testPrisma.$reset();
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(registerPayload);
    accessToken = registerResponse.body.accessToken;
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/products");

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/authorization token is required/i);
  });

  it("creates and retrieves a product", async () => {
    const createResponse = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(basePayload);

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.product.sku).toBe(basePayload.sku);

    const listResponse = await request(app)
      .get("/products")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.products).toHaveLength(1);
  });

  it("updates a product", async () => {
    const createResponse = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(basePayload);

    const updateResponse = await request(app)
      .patch(`/products/${createResponse.body.product.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ price: 170 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.product.price).toBe(170);
  });

  it("deletes a product", async () => {
    const createResponse = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(basePayload);

    const deleteResponse = await request(app)
      .delete(`/products/${createResponse.body.product.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/products/${createResponse.body.product.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(404);
  });
});

