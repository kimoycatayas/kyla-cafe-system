import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let inventoryService: typeof import("./inventoryService");
let createProduct: typeof import("../products/productService").createProduct;

const baseProductInput = {
  name: "Spanish Latte 16 oz",
  sku: "BEV-SL-016",
  price: 165,
  cost: 82,
  barcode: "4801234567891",
};

beforeAll(async () => {
  inventoryService = await import("./inventoryService");
  ({ createProduct } = await import("../products/productService"));
});

describe("inventoryService", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("creates an inventory record for a product", async () => {
    const product = await createProduct(baseProductInput);

    const inventory = await inventoryService.createInventory({
      productId: product.id,
      quantity: 50,
      lowStockThreshold: 10,
    });

    expect(inventory.product.id).toBe(product.id);
    expect(inventory.quantity).toBe(50);
    expect(inventory.status).toBe("ok");
  });

  it("updates inventory quantities", async () => {
    const product = await createProduct(baseProductInput);
    const inventory = await inventoryService.createInventory({
      productId: product.id,
      quantity: 12,
      lowStockThreshold: 10,
    });

    const updated = await inventoryService.updateInventory(inventory.id, {
      quantity: 8,
    });

    expect(updated.quantity).toBe(8);
    expect(updated.status).toBe("low");
  });

  it("lists inventory records", async () => {
    const product = await createProduct(baseProductInput);
    await inventoryService.createInventory({
      productId: product.id,
      quantity: 15,
      lowStockThreshold: 5,
    });

    const inventory = await inventoryService.listInventory();

    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.product.sku).toBe(baseProductInput.sku);
  });

  it("returns low stock alerts", async () => {
    const product = await createProduct(baseProductInput);
    await inventoryService.createInventory({
      productId: product.id,
      quantity: 3,
      lowStockThreshold: 5,
    });

    const alerts = await inventoryService.getLowStockAlerts();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.status).toBe("low");
  });

  it("deletes an inventory record", async () => {
    const product = await createProduct(baseProductInput);
    const inventory = await inventoryService.createInventory({
      productId: product.id,
      quantity: 20,
    });

    await inventoryService.deleteInventory(inventory.id);

    await expect(inventoryService.getInventoryById(inventory.id)).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });
});

