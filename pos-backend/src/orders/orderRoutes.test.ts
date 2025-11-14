import "../test/setupEnv";

import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "../generated/prisma/client";
import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

vi.mock("../auth/authMiddleware", () => ({
  authenticateUser: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: "test-user", role: "ADMIN" };
    next();
  }),
}));

let app: typeof import("../app").default;

beforeAll(async () => {
  ({ default: app } = await import("../app"));
});

const createCashier = async () =>
  testPrisma.user.create({
    data: {
      email: `cashier-${Date.now()}@kyla.ph`,
      passwordHash: "hash",
      name: "Cashier Route",
      role: "CASHIER",
    },
  });

const createProduct = async () =>
  testPrisma.product.create({
    data: {
      name: "Route Latte",
      sku: `RT-${Math.floor(Math.random() * 10_000)}`,
      price: new Prisma.Decimal(150),
      cost: new Prisma.Decimal(70),
    },
  });

const createInventory = async (productId: string, quantity = 10) =>
  testPrisma.inventory.create({
    data: {
      productId,
      quantity,
      lowStockThreshold: 2,
    },
  });

const createManager = async () =>
  testPrisma.user.create({
    data: {
      email: `manager-${Date.now()}@kyla.ph`,
      passwordHash: "hash",
      name: "Manager Route",
      role: "MANAGER",
    },
  });

const createDiscountTypePercent = async (requiresPin = false) =>
  testPrisma.discountType.create({
    data: {
      name: "Route Percent 5",
      type: "PERCENT",
      value: new Prisma.Decimal(5),
      scope: "ORDER",
      requiresManagerPin: requiresPin,
    },
  });

describe("orderRoutes", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("creates an order and adds items via HTTP", async () => {
    const cashier = await createCashier();
    const product = await createProduct();

    const createResponse = await request(app).post("/orders").send({
      cashierId: cashier.id,
    });

    expect(createResponse.status).toBe(201);
    const orderId = createResponse.body.order.id as string;

    const itemResponse = await request(app)
      .post(`/orders/${orderId}/items`)
      .send({
        productId: product.id,
        nameSnapshot: product.name,
        qty: 1,
        unitPrice: 150,
      });

    expect(itemResponse.status).toBe(201);
    expect(itemResponse.body.order.items).toHaveLength(1);
  });

  it("updates and deletes an order item via HTTP", async () => {
    const cashier = await createCashier();
    const product = await createProduct();

    const { body: orderBody } = await request(app).post("/orders").send({
      cashierId: cashier.id,
    });
    const orderId = orderBody.order.id as string;

    const { body: withItem } = await request(app)
      .post(`/orders/${orderId}/items`)
      .send({
        productId: product.id,
        nameSnapshot: product.name,
        qty: 2,
        unitPrice: 150,
      });

    const itemId = withItem.order.items[0].id as string;

    const updateResponse = await request(app)
      .patch(`/orders/${orderId}/items/${itemId}`)
      .send({ qty: 3 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.order.subtotal).toBeCloseTo(450);

    const deleteResponse = await request(app).delete(
      `/orders/${orderId}/items/${itemId}`,
    );
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.order.items).toHaveLength(0);
  });

  it("applies and removes order discounts via HTTP", async () => {
    const cashier = await createCashier();
    const manager = await createManager();
    const discountType = await createDiscountTypePercent(true);
    const product = await createProduct();

    const { body: orderBody } = await request(app).post("/orders").send({
      cashierId: cashier.id,
    });
    const orderId = orderBody.order.id as string;

    await request(app).post(`/orders/${orderId}/items`).send({
      productId: product.id,
      nameSnapshot: product.name,
      qty: 2,
      unitPrice: 200,
    });

    const applyResponse = await request(app)
      .post(`/orders/${orderId}/discounts`)
      .send({
        discountTypeId: discountType.id,
        appliedByUserId: cashier.id,
        approvedByManagerId: manager.id,
      });

    expect(applyResponse.status).toBe(201);
    expect(applyResponse.body.order.discountTotal).toBeGreaterThan(0);

    const discountRecord = await testPrisma.orderDiscount.findMany({
      where: { orderId },
    });
    const discountId = discountRecord[0]!.id;

    const updateResponse = await request(app)
      .patch(`/orders/${orderId}/discounts/${discountId}`)
      .send({ amount: 25 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.order.discountTotal).toBeCloseTo(25);

    const deleteResponse = await request(app).delete(
      `/orders/${orderId}/discounts/${discountId}`,
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.order.discountTotal).toBeCloseTo(0);
  });

  it("finalizes an order and returns checkout helpers via HTTP", async () => {
    const cashier = await createCashier();
    const product = await createProduct();
    await createInventory(product.id, 5);

    const { body: orderBody } = await request(app).post("/orders").send({
      cashierId: cashier.id,
    });
    const orderId = orderBody.order.id as string;

    await request(app).post(`/orders/${orderId}/items`).send({
      productId: product.id,
      nameSnapshot: product.name,
      qty: 2,
      unitPrice: 150,
    });

    const finalizeResponse = await request(app)
      .post(`/orders/${orderId}/finalize`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: 300,
            tenderedAmount: 500,
            processedByUserId: cashier.id,
          },
        ],
      });

    expect(finalizeResponse.status).toBe(200);
    expect(finalizeResponse.body.order.status).toBe("PAID");

    const summaryResponse = await request(app).get(
      `/orders/${orderId}/summary`,
    );
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.summary.order.status).toBe("PAID");

    const receiptResponse = await request(app).get(
      `/orders/${orderId}/receipt`,
    );
    expect(receiptResponse.status).toBe(200);
    expect(receiptResponse.body.receipt.payments).toHaveLength(1);

    await createDiscountTypePercent();

    const configResponse = await request(app).get("/orders/config");
    expect(configResponse.status).toBe(200);
    expect(configResponse.body.config.paymentMethods.length).toBeGreaterThan(0);
  });

  it("refunds a paid order via HTTP", async () => {
    const cashier = await createCashier();
    const product = await createProduct();
    await createInventory(product.id, 3);

    const { body: orderBody } = await request(app).post("/orders").send({
      cashierId: cashier.id,
    });
    const orderId = orderBody.order.id as string;

    await request(app).post(`/orders/${orderId}/items`).send({
      productId: product.id,
      nameSnapshot: product.name,
      qty: 1,
      unitPrice: 150,
    });

    await request(app).post(`/orders/${orderId}/finalize`).send({
      payments: [
        {
          method: "CARD",
          amount: 150,
          processedByUserId: cashier.id,
        },
      ],
    });

    const refundResponse = await request(app)
      .post(`/orders/${orderId}/refund`)
      .send({
        payments: [
          {
            method: "CARD",
            amount: 150,
            processedByUserId: cashier.id,
          },
        ],
      });

    expect(refundResponse.status).toBe(200);
    expect(refundResponse.body.order.status).toBe("REFUNDED");
    expect(
      refundResponse.body.order.payments.some(
        (payment: { amount: number }) => payment.amount < 0,
      ),
    ).toBe(true);
  });
});

