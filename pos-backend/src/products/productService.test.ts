import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let createProduct: typeof import("./productService").createProduct;
let listProducts: typeof import("./productService").listProducts;
let getProductById: typeof import("./productService").getProductById;
let updateProduct: typeof import("./productService").updateProduct;
let deleteProduct: typeof import("./productService").deleteProduct;

const baseInput = {
  name: "Spanish Latte 16 oz",
  sku: "BEV-SL-016",
  price: 165,
  cost: 82,
  barcode: "4801234567891",
};

beforeAll(async () => {
  ({
    createProduct,
    listProducts,
    getProductById,
    updateProduct,
    deleteProduct,
  } = await import("./productService"));
});

describe("productService", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("creates a product", async () => {
    const product = await createProduct(baseInput);

    expect(product.name).toBe(baseInput.name);
    expect(product.price).toBe(165);
    expect(product.cost).toBe(82);
  });

  it("lists products in reverse chronological order", async () => {
    await createProduct(baseInput);
    await createProduct({
      name: "Matcha Cloud 12 oz",
      sku: "BEV-MC-012",
      price: 175,
      cost: 88,
      barcode: "4801234567846",
    });

    const products = await listProducts();

    expect(products).toHaveLength(2);
    const [latest] = products;
    expect(latest).toBeDefined();
    expect(latest!.sku).toBe("BEV-MC-012");
  });

  it("retrieves product by id", async () => {
    const created = await createProduct(baseInput);

    const product = await getProductById(created.id);

    expect(product.id).toBe(created.id);
    expect(product.sku).toBe(baseInput.sku);
  });

  it("updates product fields", async () => {
    const created = await createProduct(baseInput);

    const updated = await updateProduct(created.id, {
      price: 170,
      barcode: null,
    });

    expect(updated.price).toBe(170);
    expect(updated.barcode).toBeNull();
  });

  it("deletes a product", async () => {
    const created = await createProduct(baseInput);

    await deleteProduct(created.id);

    await expect(getProductById(created.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

