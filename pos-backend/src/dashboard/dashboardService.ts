import { OrderStatus, Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";

const toNumber = (
  value: Prisma.Decimal | string | number | null | undefined
): number => {
  if (value instanceof Prisma.Decimal) {
    return Number(value.toFixed(2));
  }
  if (typeof value === "string") {
    return Number.parseFloat(value);
  }
  if (typeof value === "number") {
    return Number(value.toFixed(2));
  }
  return 0;
};

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysAgo = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
};

export type DashboardMetrics = {
  salesSummary: {
    totalSalesToday: number;
    ordersToday: number;
    averageOrderValueToday: number;
    openOrders: number;
  };
  topProducts: Array<{
    productId: string | null;
    name: string;
    quantity: number;
    sales: number;
  }>;
  lowStockItems: Array<{
    productId: string;
    name: string;
    quantity: number;
    threshold: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    amount: number;
    createdAt: Date;
    cashierName: string | null;
  }>;
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const today = startOfDay(new Date());
  const sevenDaysAgo = daysAgo(today, 7);

  const orders = await prisma.order.findMany({
    include: {
      cashier: true,
    },
  });

  const paidOrdersToday = orders.filter(
    (order) =>
      order.status === OrderStatus.PAID && order.createdAt >= today
  );

  const totalSalesTodayRaw = paidOrdersToday.reduce(
    (sum, order) => sum + toNumber(order.totalPaid as unknown as Prisma.Decimal),
    0
  );
  const totalSalesToday = Number(totalSalesTodayRaw.toFixed(2));
  const ordersToday = paidOrdersToday.length;
  const averageOrderValueToday =
    ordersToday > 0 ? Number((totalSalesToday / ordersToday).toFixed(2)) : 0;
  const openOrdersCount = orders.filter(
    (order) => order.status === OrderStatus.OPEN
  ).length;

  const orderMap = new Map(orders.map((order) => [order.id, order]));

  const orderItems = await prisma.orderItem.findMany({ where: {} });

  const productTotals = new Map<
    string,
    { productId: string | null; name: string; quantity: number; sales: number }
  >();

  for (const item of orderItems) {
    const order = orderMap.get(item.orderId);
    if (
      !order ||
      order.status !== OrderStatus.PAID ||
      order.createdAt < sevenDaysAgo
    ) {
      continue;
    }

    const key = `${item.productId ?? "custom"}::${item.nameSnapshot}`;
    const existing =
      productTotals.get(key) ??
      {
        productId: item.productId ?? null,
        name: item.nameSnapshot,
        quantity: 0,
        sales: 0,
      };

    existing.quantity += item.qty;
    existing.sales = Number(
      (existing.sales +
        toNumber(item.lineTotal as unknown as Prisma.Decimal)).toFixed(2)
    );

    productTotals.set(key, existing);
  }

  const topProducts = [...productTotals.values()]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  const inventoryRecords = await prisma.inventory.findMany({
    include: { product: true },
  });

  const missingCashierIds = orders
    .filter(
      (order) =>
        !order.cashier ||
        !order.cashier.name ||
        order.cashier.name.trim().length === 0
    )
    .map((order) => order.cashierId);

  const cashierLookupEntries = await Promise.all(
    [...new Set(missingCashierIds)].map(async (cashierId) => {
      const cashier = await prisma.user.findUnique({
        where: { id: cashierId },
      });
      return [cashierId, cashier] as const;
    })
  );

  const cashierLookup = new Map(cashierLookupEntries);

  const lowStockItems = inventoryRecords
    .sort((a, b) => a.quantity - b.quantity)
    .filter(
      (record) =>
        record.product !== null && record.quantity <= record.lowStockThreshold
    )
    .slice(0, 5)
    .map((record) => ({
      productId: record.productId,
      name: record.product!.name,
      quantity: record.quantity,
      threshold: record.lowStockThreshold,
    }));

  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((order) => {
      const paidAmount = toNumber(order.totalPaid as unknown as Prisma.Decimal);
      const dueAmount = toNumber(order.totalDue as unknown as Prisma.Decimal);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        amount:
          order.status === OrderStatus.PAID
            ? Number(paidAmount.toFixed(2))
            : Number(dueAmount.toFixed(2)),
        createdAt: order.createdAt,
        cashierName:
          order.cashier?.name?.trim() ||
          cashierLookup.get(order.cashierId)?.name?.trim() ||
          order.cashier?.email ||
          cashierLookup.get(order.cashierId)?.email ||
          order.cashierId ||
          null,
      };
    });

  return {
    salesSummary: {
      totalSalesToday,
      ordersToday,
      averageOrderValueToday,
      openOrders: openOrdersCount,
    },
    topProducts,
    lowStockItems,
    recentOrders,
  };
};

