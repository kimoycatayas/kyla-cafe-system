import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "../generated/prisma/client";
import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let createOrder: typeof import("./orderService").createOrder;
let listOrders: typeof import("./orderService").listOrders;
let getOrderById: typeof import("./orderService").getOrderById;
let updateOrder: typeof import("./orderService").updateOrder;
let deleteOrder: typeof import("./orderService").deleteOrder;
let addOrderItem: typeof import("./orderService").addOrderItem;
let updateOrderItem: typeof import("./orderService").updateOrderItem;
let removeOrderItem: typeof import("./orderService").removeOrderItem;
let applyOrderDiscount: typeof import("./orderService").applyOrderDiscount;
let updateOrderDiscount: typeof import("./orderService").updateOrderDiscount;
let removeOrderDiscount: typeof import("./orderService").removeOrderDiscount;
let finalizeOrder: typeof import("./orderService").finalizeOrder;
let voidOrder: typeof import("./orderService").voidOrder;
let refundOrder: typeof import("./orderService").refundOrder;
let getOrderSummary: typeof import("./orderService").getOrderSummary;
let getOrderReceipt: typeof import("./orderService").getOrderReceipt;
let getCheckoutConfig: typeof import("./orderService").getCheckoutConfig;

const createCashier = async () =>
  testPrisma.user.create({
    data: {
      email: `cashier-${Date.now()}@kyla.ph`,
      passwordHash: "hash",
      name: "Cashier One",
      role: "CASHIER",
    },
  });

const createProduct = async () =>
  testPrisma.product.create({
    data: {
      name: "Spanish Latte 16 oz",
      sku: `BEV-${Math.floor(Math.random() * 10_000)}`,
      price: new Prisma.Decimal(165),
      cost: new Prisma.Decimal(82),
    },
  });

const createInventory = async (productId: string, quantity = 10) =>
  testPrisma.inventory.create({
    data: {
      productId,
      quantity,
      lowStockThreshold: 2,
    },
    include: { product: true },
  });

const createManager = async () =>
  testPrisma.user.create({
    data: {
      email: `manager-${Date.now()}@kyla.ph`,
      passwordHash: "hash",
      name: "Manager One",
      role: "MANAGER",
    },
  });

const createDiscountTypePercent = async (requiresPin = false) =>
  testPrisma.discountType.create({
    data: {
      name: "Percent 10",
      type: "PERCENT",
      value: new Prisma.Decimal(10),
      scope: "ORDER",
      requiresManagerPin: requiresPin,
    },
  });

beforeAll(async () => {
  ({
    createOrder,
    listOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    addOrderItem,
    updateOrderItem,
    removeOrderItem,
    applyOrderDiscount,
    updateOrderDiscount,
    removeOrderDiscount,
    finalizeOrder,
    voidOrder,
    refundOrder,
    getOrderSummary,
    getOrderReceipt,
    getCheckoutConfig,
  } = await import("./orderService"));
});

describe("orderService", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("creates an order and lists it", async () => {
    const cashier = await createCashier();
    const order = await createOrder({ cashierId: cashier.id });

    expect(order.cashierId).toBe(cashier.id);
    expect(order.status).toBe("OPEN");

    const orders = await listOrders();
    expect(orders).toHaveLength(1);
  });

  it("adds, updates, and removes order items while recalculating totals", async () => {
    const cashier = await createCashier();
    const product = await createProduct();

    const order = await createOrder({ cashierId: cashier.id });
    const withItem = await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 2,
      unitPrice: 165,
      lineDiscountTotal: 10,
    });

    expect(withItem.subtotal).toBeCloseTo(330);
    expect(withItem.discountTotal).toBeCloseTo(10);
    expect(withItem.totalDue).toBeCloseTo(320);

    const updated = await updateOrderItem(withItem.id, withItem.items[0]!.id, {
      qty: 3,
    });

    expect(updated.subtotal).toBeCloseTo(495);
    expect(updated.discountTotal).toBeCloseTo(10);
    expect(updated.totalDue).toBeCloseTo(485);

    const afterRemoval = await removeOrderItem(
      updated.id,
      updated.items[0]!.id
    );
    expect(afterRemoval.subtotal).toBeCloseTo(0);
    expect(afterRemoval.discountTotal).toBeCloseTo(0);
  });

  it("updates and deletes an order", async () => {
    const cashier = await createCashier();
    const order = await createOrder({ cashierId: cashier.id });

    const updated = await updateOrder(order.id, {
      status: "PAID",
      totalPaid: 500,
      changeDue: 20,
    });

    expect(updated.status).toBe("PAID");
    expect(updated.totalPaid).toBeCloseTo(500);
    expect(updated.changeDue).toBeCloseTo(20);

    await deleteOrder(order.id);

    await expect(getOrderById(order.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("applies, updates, and removes order discounts", async () => {
    const cashier = await createCashier();
    const manager = await createManager();
    const discountType = await createDiscountTypePercent(true);
    const product = await createProduct();

    const order = await createOrder({ cashierId: cashier.id });
    await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 2,
      unitPrice: 200,
    });

    const discounted = await applyOrderDiscount(order.id, {
      discountTypeId: discountType.id,
      appliedByUserId: cashier.id,
      approvedByManagerId: manager.id,
    });

    expect(discounted.discountTotal).toBeGreaterThan(0);

    const discountRecord = await testPrisma.orderDiscount.findMany({
      where: { orderId: order.id },
    });
    const discountId = discountRecord[0]!.id;

    const updated = await updateOrderDiscount(order.id, discountId, {
      amount: 30,
    });

    expect(updated.discountTotal).toBeCloseTo(30);

    const finalOrder = await removeOrderDiscount(order.id, discountId);
    expect(finalOrder.discountTotal).toBeCloseTo(0);
  });

  it("finalizes an order with payments and updates inventory", async () => {
    const cashier = await createCashier();
    const product = await createProduct();
    await createInventory(product.id, 5);

    const order = await createOrder({ cashierId: cashier.id });
    await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 2,
      unitPrice: 165,
    });

    const finalized = await finalizeOrder(order.id, {
      payments: [
        {
          method: "CASH",
          amount: 330,
          tenderedAmount: 350,
          processedByUserId: cashier.id,
        },
      ],
    });

    expect(finalized.status).toBe("PAID");
    expect(finalized.totalPaid).toBeCloseTo(330);
    expect(finalized.changeDue).toBeCloseTo(20);
    expect(finalized.payments).toHaveLength(1);

    const inventoryRecord = await testPrisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(inventoryRecord?.quantity).toBe(3);
  });

  it("voids an order before payment", async () => {
    const cashier = await createCashier();
    const product = await createProduct();

    const order = await createOrder({ cashierId: cashier.id });
    await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 1,
      unitPrice: 150,
    });

    const voided = await voidOrder(order.id);
    expect(voided.status).toBe("VOID");
    expect(voided.totalPaid).toBeCloseTo(0);

    const voidedAgain = await voidOrder(order.id);
    expect(voidedAgain.status).toBe("VOID");
  });

  it("refunds a paid order and restocks inventory", async () => {
    const cashier = await createCashier();
    const product = await createProduct();
    await createInventory(product.id, 4);

    const order = await createOrder({ cashierId: cashier.id });
    await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 1,
      unitPrice: 200,
    });

    await finalizeOrder(order.id, {
      payments: [
        {
          method: "CARD",
          amount: 200,
          processedByUserId: cashier.id,
        },
      ],
    });

    const refunded = await refundOrder(order.id, {
      payments: [
        {
          method: "CARD",
          amount: 200,
          processedByUserId: cashier.id,
        },
      ],
    });

    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.totalPaid).toBeCloseTo(0);
    expect(refunded.payments.some((payment) => payment.amount < 0)).toBe(true);

    const inventoryRecord = await testPrisma.inventory.findUnique({
      where: { productId: product.id },
    });
    expect(inventoryRecord?.quantity).toBe(4);
  });

  it("returns order summary and receipt data", async () => {
    const cashier = await createCashier();
    const product = await createProduct();
    await createInventory(product.id, 3);

    const order = await createOrder({ cashierId: cashier.id });
    await addOrderItem(order.id, {
      productId: product.id,
      nameSnapshot: product.name,
      qty: 1,
      unitPrice: 150,
    });

    await finalizeOrder(order.id, {
      payments: [
        {
          method: "CASH",
          amount: 150,
          tenderedAmount: 200,
          processedByUserId: cashier.id,
        },
      ],
    });

    const summary = await getOrderSummary(order.id);
    expect(summary.order.status).toBe("PAID");
    expect(summary.totals.totalPaid).toBeCloseTo(150);
    expect(summary.totals.balanceDue).toBeCloseTo(0);
    expect(summary.paymentCount).toBe(1);

    const receipt = await getOrderReceipt(order.id);
    expect(receipt.orderNumber).toBe(summary.order.orderNumber);
    expect(receipt.payments).toHaveLength(1);
    expect(receipt.totals.totalDue).toBeCloseTo(150);
    expect(receipt.cashierName).toBe("Cashier One");
    expect(receipt.printable.filename).toContain("receipt.txt");
    expect(receipt.printable.content).toContain(summary.order.orderNumber);
  });

  it("provides checkout configuration data", async () => {
    await createDiscountTypePercent();

    const config = await getCheckoutConfig();

    expect(config.paymentMethods.length).toBeGreaterThan(0);
    expect(
      config.paymentMethods.some((method) => method.value === "CASH")
    ).toBe(true);
    expect(config.discountTypes.length).toBeGreaterThan(0);
  });
});
