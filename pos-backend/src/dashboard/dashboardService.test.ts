import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "../generated/prisma/client";
import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let getDashboardMetrics: typeof import("./dashboardService").getDashboardMetrics;

const createUser = async () =>
  testPrisma.user.create({
    data: {
      email: `owner-${Date.now()}@example.com`,
      passwordHash: "hash",
      name: "Owner One",
      role: "ADMIN",
    },
  });

const createProductWithInventory = async (
  name: string,
  sku: string,
  quantity: number,
  threshold: number
) => {
  const product = await testPrisma.product.create({
    data: {
      name,
      sku,
      price: new Prisma.Decimal(150),
      cost: new Prisma.Decimal(70),
    },
  });

  await testPrisma.inventory.create({
    data: {
      productId: product.id,
      quantity,
      lowStockThreshold: threshold,
    },
  });

  return product;
};

beforeAll(async () => {
  ({ getDashboardMetrics } = await import("./dashboardService"));
});

describe("dashboardService.getDashboardMetrics", () => {
  beforeEach(async () => {
    await testPrisma.$reset();
  });

  it("aggregates sales, inventory, and order insights", async () => {
    const user = await createUser();
    const productA = await createProductWithInventory("Spanish Latte", "SKU-A", 3, 5);
    const productB = await createProductWithInventory("Cold Brew", "SKU-B", 12, 5);

    const paidOrder = await testPrisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        cashierId: user.id,
        status: "PAID",
        subtotal: new Prisma.Decimal(300),
        discountTotal: new Prisma.Decimal(0),
        totalDue: new Prisma.Decimal(300),
        totalPaid: new Prisma.Decimal(300),
        changeDue: new Prisma.Decimal(0),
        createdAt: new Date(),
      },
    });

    await testPrisma.orderItem.create({
      data: {
        orderId: paidOrder.id,
        productId: productA.id,
        nameSnapshot: productA.name,
        qty: 2,
        unitPrice: new Prisma.Decimal(150),
        lineSubtotal: new Prisma.Decimal(300),
        lineDiscountTotal: new Prisma.Decimal(0),
        lineTotal: new Prisma.Decimal(300),
      },
    });

    const openOrder = await testPrisma.order.create({
      data: {
        orderNumber: `ORD-OPEN-${Date.now()}`,
        cashierId: user.id,
        status: "OPEN",
        subtotal: new Prisma.Decimal(0),
        discountTotal: new Prisma.Decimal(0),
        totalDue: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        changeDue: new Prisma.Decimal(0),
      },
    });

    await testPrisma.orderItem.create({
      data: {
        orderId: openOrder.id,
        productId: productB.id,
        nameSnapshot: productB.name,
        qty: 1,
        unitPrice: new Prisma.Decimal(150),
        lineSubtotal: new Prisma.Decimal(150),
        lineDiscountTotal: new Prisma.Decimal(0),
        lineTotal: new Prisma.Decimal(150),
      },
    });

    const metrics = await getDashboardMetrics();

    expect(metrics.salesSummary.totalSalesToday).toBeCloseTo(300);
    expect(metrics.salesSummary.ordersToday).toBe(1);
    expect(metrics.salesSummary.averageOrderValueToday).toBeCloseTo(300);
    expect(metrics.salesSummary.openOrders).toBe(1);

    expect(metrics.topProducts.length).toBeGreaterThanOrEqual(1);
    expect(metrics.topProducts[0]?.name).toBe("Spanish Latte");
    expect(metrics.topProducts[0]?.quantity).toBe(2);

    expect(metrics.lowStockItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: productA.id,
          name: "Spanish Latte",
          quantity: 3,
          threshold: 5,
        }),
      ])
    );

    expect(metrics.recentOrders.length).toBeGreaterThanOrEqual(2);
    const recentPaid = metrics.recentOrders.find(
      (order) => order.id === paidOrder.id
    );
    expect(recentPaid).toMatchObject({
      amount: 300,
      status: "PAID",
      cashierName: "Owner One",
    });
  });
});



