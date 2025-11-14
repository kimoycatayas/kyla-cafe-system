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
let createProduct: typeof import("../products/productService").createProduct;
let accessToken: string;

const baseRegisterPayload = {
  email: "user@inventory.test",
  password: "SecurePassw0rd!",
  businessName: "Inventory Test",
  industry: "QA",
  fullName: "Inventory QA",
  contactNumber: "+63 917 000 0000",
};

const baseProductInput = {
  name: "Matcha Cloud 12 oz",
  sku: "BEV-MC-012",
  price: 175,
  cost: 88,
  barcode: "4801234567846",
};

beforeAll(async () => {
  ({ default: app } = await import("../app"));
  ({ createProduct } = await import("../products/productService"));
});

describe("inventory routes", () => {
  beforeEach(() => {
    testPrisma.$reset();
    accessToken = "";
  });

  it("creates and lists inventory", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send(baseRegisterPayload);
    accessToken = authResponse.body.accessToken;

    const product = await createProduct(baseProductInput);

    const createResponse = await request(app)
      .post("/inventory")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: product.id,
        quantity: 40,
        lowStockThreshold: 8,
      });

    expect(createResponse.status).toBe(201);

    const listResponse = await request(app)
      .get("/inventory")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.inventory).toHaveLength(1);
  });

  it("returns stock tracker data", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send({ ...baseRegisterPayload, email: "stock@inventory.test" });
    accessToken = authResponse.body.accessToken;

    const product = await createProduct(baseProductInput);
    await request(app)
      .post("/inventory")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: product.id,
        quantity: 4,
        lowStockThreshold: 6,
      });

    const tracker = await request(app)
      .get("/inventory/stock-tracker")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(tracker.status).toBe(200);
    expect(tracker.body.inventory[0]?.status).toBe("low");
  });

  it("returns low stock alerts", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send({ ...baseRegisterPayload, email: "alerts@inventory.test" });
    accessToken = authResponse.body.accessToken;

    const product = await createProduct(baseProductInput);
    await request(app)
      .post("/inventory")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: product.id,
        quantity: 2,
        lowStockThreshold: 5,
      });

    const alerts = await request(app)
      .get("/inventory/low-stock")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(alerts.status).toBe(200);
    expect(alerts.body.inventory).toHaveLength(1);
  });

  it("updates and deletes inventory", async () => {
    const authResponse = await request(app)
      .post("/auth/register")
      .send({ ...baseRegisterPayload, email: "update@inventory.test" });
    accessToken = authResponse.body.accessToken;

    const product = await createProduct(baseProductInput);
    const createResponse = await request(app)
      .post("/inventory")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: product.id,
        quantity: 12,
        lowStockThreshold: 5,
      });

    const inventoryId = createResponse.body.inventory.id as string;

    const updateResponse = await request(app)
      .patch(`/inventory/${inventoryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ quantity: 20 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.inventory.quantity).toBe(20);

    const deleteResponse = await request(app)
      .delete(`/inventory/${inventoryId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(204);
  });
});

