import {
  DiscountScope,
  DiscountTypeKind,
  OrderStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from "../generated/prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { buildReceipt } from "./receiptBuilder";
import type { ReceiptRender } from "./receiptBuilder";

type Decimalish = number | string | Prisma.Decimal;

type PrismaClientOrTransaction = Prisma.TransactionClient | typeof prisma;

const ORDER_INCLUDE = {
  items: true,
  discounts: {
    include: {
      discountType: true,
    },
  },
  payments: true,
} as const;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.GCASH]: "GCash",
  [PaymentMethod.PAYMAYA]: "PayMaya",
  [PaymentMethod.STATIC_QR]: "Static QR",
  [PaymentMethod.CONTACTLESS]: "Contactless",
};

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

type OrderItemPayload = Prisma.OrderItemGetPayload<Record<string, never>>;

type OrderDiscountPayload = Prisma.OrderDiscountGetPayload<{
  include: {
    discountType: true;
  };
}>;

type PaymentPayload = Prisma.PaymentGetPayload<Record<string, never>>;

export type CreateOrderInput = {
  cashierId: string;
  orderNumber?: string;
  status?: OrderStatus;
};

export type UpdateOrderInput = {
  status?: OrderStatus;
  cashierId?: string;
  totalPaid?: Decimalish;
  changeDue?: Decimalish;
};

export type OrderItemInput = {
  productId?: string | null;
  nameSnapshot: string;
  notes?: string | null;
  qty: number;
  unitPrice: Decimalish;
  lineDiscountTotal?: Decimalish;
};

export type OrderItemUpdateInput = Partial<OrderItemInput>;

const ZERO = new Prisma.Decimal(0);

const money = (value: Decimalish): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, "Amount must be a valid number.");
  }

  return new Prisma.Decimal(numeric.toFixed(2));
};

const toNumber = (value: Prisma.Decimal | Decimalish): number =>
  Number(money(value).toFixed(2));

const mapOrderItem = (item: OrderItemPayload) => ({
  id: item.id,
  orderId: item.orderId,
  productId: item.productId,
  nameSnapshot: item.nameSnapshot,
  notes: item.notes ?? null,
  qty: item.qty,
  unitPrice: toNumber(item.unitPrice),
  lineSubtotal: toNumber(item.lineSubtotal),
  lineDiscountTotal: toNumber(item.lineDiscountTotal),
  lineTotal: toNumber(item.lineTotal),
});

type DiscountTypeResponse = {
  id: string;
  name: string;
  type: DiscountTypeKind;
  value: number;
  scope: DiscountScope;
  requiresManagerPin: boolean;
};

type OrderDiscountResponse = {
  id: string;
  orderId: string;
  discountTypeId: string;
  amount: number;
  appliedByUserId: string;
  approvedByManagerId: string | null;
  createdAt: Date;
  discountType?: DiscountTypeResponse | null;
};

type PaymentResponse = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount: number | null;
  changeGiven: number | null;
  externalReference: string | null;
  processedByUserId: string;
  createdAt: Date;
};

export type PaymentInput = {
  method: PaymentMethod;
  amount: Decimalish;
  tenderedAmount?: Decimalish | null;
  changeGiven?: Decimalish | null;
  externalReference?: string | null;
  processedByUserId: string;
};

type RefundPaymentInput = {
  method: PaymentMethod;
  amount: Decimalish;
  externalReference?: string | null;
  processedByUserId: string;
};

export type FinalizeOrderInput = {
  payments: PaymentInput[];
};

export type RefundOrderInput = {
  payments: RefundPaymentInput[];
  restock?: boolean;
};

type CheckoutTotals = {
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  totalPaid: number;
  changeDue: number;
  balanceDue: number;
};

export type OrderSummaryResponse = {
  order: OrderResponse;
  totals: CheckoutTotals;
  itemCount: number;
  paymentCount: number;
};

export type OrderReceiptDetails = {
  orderNumber: string;
  createdAt: Date;
  status: OrderStatus;
  cashierId: string;
  cashierName: string;
  items: OrderResponse["items"];
  discounts: OrderResponse["discounts"];
  payments: PaymentResponse[];
  totals: CheckoutTotals;
};

export type OrderReceiptResponse = OrderReceiptDetails & {
  printable: ReceiptRender;
};

export type CheckoutConfigResponse = {
  paymentMethods: Array<{
    value: PaymentMethod;
    label: string;
  }>;
  discountTypes: DiscountTypeResponse[];
};

export type OrderResponse = {
  id: string;
  orderNumber: string;
  cashierId: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  totalPaid: number;
  changeDue: number;
  createdAt: Date;
  updatedAt: Date;
  items: ReturnType<typeof mapOrderItem>[];
  discounts: OrderDiscountResponse[];
  payments: PaymentResponse[];
};

const mapDiscount = (
  discount: OrderDiscountPayload
): OrderDiscountResponse => ({
  id: discount.id,
  orderId: discount.orderId,
  discountTypeId: discount.discountTypeId,
  amount: toNumber(discount.amount),
  appliedByUserId: discount.appliedByUserId,
  approvedByManagerId: discount.approvedByManagerId ?? null,
  createdAt: discount.createdAt,
  discountType: discount.discountType
    ? {
        id: discount.discountType.id,
        name: discount.discountType.name,
        type: discount.discountType.type,
        value: toNumber(discount.discountType.value),
        scope: discount.discountType.scope,
        requiresManagerPin: discount.discountType.requiresManagerPin,
      }
    : null,
});

const mapPayment = (payment: PaymentPayload): PaymentResponse => ({
  id: payment.id,
  orderId: payment.orderId,
  method: payment.method,
  amount: toNumber(payment.amount),
  tenderedAmount:
    payment.tenderedAmount !== null ? toNumber(payment.tenderedAmount) : null,
  changeGiven:
    payment.changeGiven !== null ? toNumber(payment.changeGiven) : null,
  externalReference: payment.externalReference ?? null,
  processedByUserId: payment.processedByUserId,
  createdAt: payment.createdAt,
});

const mapOrder = (order: OrderWithRelations): OrderResponse => ({
  id: order.id,
  orderNumber: order.orderNumber,
  cashierId: order.cashierId,
  status: order.status,
  subtotal: toNumber(order.subtotal),
  discountTotal: toNumber(order.discountTotal),
  totalDue: toNumber(order.totalDue),
  totalPaid: toNumber(order.totalPaid),
  changeDue: toNumber(order.changeDue),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: order.items.map(mapOrderItem),
  discounts: order.discounts.map(mapDiscount),
  payments: order.payments.map(mapPayment),
});

const fetchOrderWithRelationsOrThrow = async (
  client: PrismaClientOrTransaction,
  id: string
): Promise<OrderWithRelations> => {
  const order = await client.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  });

  if (!order) {
    throw new HttpError(404, "Order not found.");
  }

  return order;
};

const ensureUserExistsWithClient = async (
  client: PrismaClientOrTransaction,
  userId: string
) => {
  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  return user;
};

const ensureUserExists = async (userId: string) =>
  ensureUserExistsWithClient(prisma, userId);

type InventoryAdjustment = {
  id: string;
  quantity: number;
};

const collectInventoryAdjustments = async (
  client: PrismaClientOrTransaction,
  items: OrderItemPayload[],
  multiplier: number
): Promise<InventoryAdjustment[]> => {
  // Filter items with productId
  const itemsWithProducts = items.filter((item) => item.productId);
  if (itemsWithProducts.length === 0) {
    return [];
  }

  // Batch fetch all inventory records at once
  const productIds = itemsWithProducts.map((item) => item.productId!);
  const inventoryRecords = await client.inventory.findMany({
    where: { productId: { in: productIds } },
  });

  // Create a map for quick lookup
  const inventoryMap = new Map(
    inventoryRecords.map((inv) => [inv.productId, inv])
  );

  const adjustments: InventoryAdjustment[] = [];

  for (const item of itemsWithProducts) {
    const inventory = inventoryMap.get(item.productId!);

    if (!inventory) {
      throw new HttpError(
        409,
        "Inventory record not found for product linked to this order item."
      );
    }

    const nextQuantity = inventory.quantity + item.qty * multiplier;

    if (nextQuantity < 0) {
      throw new HttpError(
        409,
        "Insufficient stock to complete this operation for one or more items."
      );
    }

    adjustments.push({
      id: inventory.id,
      quantity: nextQuantity,
    });
  }

  return adjustments;
};

const applyInventoryAdjustments = async (
  client: PrismaClientOrTransaction,
  adjustments: InventoryAdjustment[]
) => {
  if (adjustments.length === 0) {
    return;
  }

  // Batch update inventory using Promise.all for parallel execution
  // Note: Prisma doesn't support updateMany with different values per row,
  // so we use parallel individual updates which is still faster than sequential
  await Promise.all(
    adjustments.map((adjustment) =>
      client.inventory.update({
        where: { id: adjustment.id },
        data: { quantity: adjustment.quantity },
      })
    )
  );
};

type PreparedPayment = {
  method: PaymentMethod;
  amount: Prisma.Decimal;
  tenderedAmount: Prisma.Decimal;
  changeGiven: Prisma.Decimal;
  externalReference: string | null;
  processedByUserId: string;
};

const prepareFinalizePayments = async (
  client: PrismaClientOrTransaction,
  payments: PaymentInput[]
): Promise<{
  entries: PreparedPayment[];
  totalApplied: Prisma.Decimal;
  totalTendered: Prisma.Decimal;
}> => {
  if (!payments.length) {
    throw new HttpError(400, "At least one payment is required to finalize.");
  }

  const entries: PreparedPayment[] = [];
  let totalApplied = ZERO;
  let totalTendered = ZERO;

  for (const payment of payments) {
    const amount = money(payment.amount);

    if (amount.lessThanOrEqualTo(ZERO)) {
      throw new HttpError(
        400,
        "Payment amounts must be greater than zero when finalizing an order."
      );
    }

    const tendered =
      payment.tenderedAmount !== undefined && payment.tenderedAmount !== null
        ? money(payment.tenderedAmount)
        : amount;

    if (tendered.lessThan(amount)) {
      throw new HttpError(
        400,
        "Tendered amount cannot be less than the payment amount."
      );
    }

    const rawChange =
      payment.changeGiven !== undefined && payment.changeGiven !== null
        ? money(payment.changeGiven)
        : tendered.sub(amount);

    if (rawChange.lessThan(ZERO)) {
      throw new HttpError(
        400,
        "Change due cannot be negative. Please verify the tendered amount."
      );
    }

    if (rawChange.greaterThan(tendered)) {
      throw new HttpError(
        400,
        "Change given cannot exceed the tendered amount for a payment."
      );
    }

    const processor = await ensureUserExistsWithClient(
      client,
      payment.processedByUserId
    );

    const entry: PreparedPayment = {
      method: payment.method,
      amount,
      tenderedAmount: tendered,
      changeGiven: rawChange,
      externalReference: payment.externalReference?.trim() ?? null,
      processedByUserId: processor.id,
    };

    entries.push(entry);
    totalApplied = totalApplied.add(amount);
    totalTendered = totalTendered.add(tendered);
  }

  return { entries, totalApplied, totalTendered };
};

type PreparedRefundPayment = {
  method: PaymentMethod;
  amount: Prisma.Decimal;
  externalReference: string | null;
  processedByUserId: string;
};

const prepareRefundPayments = async (
  client: PrismaClientOrTransaction,
  payments: RefundPaymentInput[]
): Promise<{
  entries: PreparedRefundPayment[];
  totalRefund: Prisma.Decimal;
}> => {
  if (!payments.length) {
    throw new HttpError(400, "At least one refund payment is required.");
  }

  const entries: PreparedRefundPayment[] = [];
  let totalRefund = ZERO;

  for (const payment of payments) {
    const amount = money(payment.amount);

    if (amount.lessThanOrEqualTo(ZERO)) {
      throw new HttpError(
        400,
        "Refund payment amounts must be greater than zero."
      );
    }

    const processor = await ensureUserExistsWithClient(
      client,
      payment.processedByUserId
    );

    entries.push({
      method: payment.method,
      amount: amount.mul(-1),
      externalReference: payment.externalReference?.trim() ?? null,
      processedByUserId: processor.id,
    });

    totalRefund = totalRefund.add(amount);
  }

  return { entries, totalRefund };
};

const ensureCashierExists = async (cashierId: string) => {
  await ensureUserExists(cashierId);
};

const generateOrderNumber = (): string =>
  `ORD-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;

const recalculateOrderTotals = async (orderId: string) => {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
  });

  const subtotal = items.reduce(
    (sum, item) => sum.add(item.lineSubtotal),
    ZERO
  );

  const itemDiscount = items.reduce(
    (sum, item) => sum.add(item.lineDiscountTotal),
    ZERO
  );

  const discountAggregate = await prisma.orderDiscount.aggregate({
    where: { orderId },
    _sum: { amount: true },
  });

  const orderDiscount =
    discountAggregate._sum.amount !== null &&
    discountAggregate._sum.amount !== undefined
      ? money(discountAggregate._sum.amount)
      : ZERO;
  const discountTotal = itemDiscount.add(orderDiscount);
  const totalDue = subtotal.sub(discountTotal);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      discountTotal,
      totalDue,
    },
  });
};

export const listOrders = async (): Promise<OrderResponse[]> => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: ORDER_INCLUDE,
  });

  return orders.map(mapOrder);
};

export const getOrderById = async (id: string): Promise<OrderResponse> => {
  const order = await fetchOrderWithRelationsOrThrow(prisma, id);
  return mapOrder(order);
};

export const createOrder = async (
  input: CreateOrderInput
): Promise<OrderResponse> => {
  await ensureCashierExists(input.cashierId);

  const order = await prisma.order.create({
    data: {
      orderNumber: input.orderNumber ?? generateOrderNumber(),
      cashierId: input.cashierId,
      status: input.status ?? OrderStatus.OPEN,
      subtotal: ZERO,
      discountTotal: ZERO,
      totalDue: ZERO,
      totalPaid: ZERO,
      changeDue: ZERO,
    },
    include: ORDER_INCLUDE,
  });

  return mapOrder(order);
};

export const updateOrder = async (
  id: string,
  input: UpdateOrderInput
): Promise<OrderResponse> => {
  const data: Prisma.OrderUncheckedUpdateInput = {};

  if (input.status) {
    data.status = input.status;
  }

  if (input.cashierId) {
    await ensureCashierExists(input.cashierId);
    data.cashierId = input.cashierId;
  }

  if (input.totalPaid !== undefined) {
    data.totalPaid = money(input.totalPaid);
  }

  if (input.changeDue !== undefined) {
    data.changeDue = money(input.changeDue);
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: ORDER_INCLUDE,
  });

  return mapOrder(order);
};

export const deleteOrder = async (id: string): Promise<void> => {
  await prisma.order.delete({
    where: { id },
  });
};

export const finalizeOrder = async (
  orderId: string,
  input: FinalizeOrderInput
): Promise<OrderResponse> =>
  prisma.$transaction(async (tx) => {
    const order = await fetchOrderWithRelationsOrThrow(tx, orderId);

    if (order.status === OrderStatus.PAID) {
      throw new HttpError(409, "Order has already been finalized.");
    }

    if (
      order.status === OrderStatus.VOID ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new HttpError(409, "Void or refunded orders cannot be finalized.");
    }

    if (order.items.length === 0) {
      throw new HttpError(
        400,
        "Add at least one item to the order before finalizing."
      );
    }

    // Recalculate order totals to ensure they're up-to-date before finalizing
    const items = await tx.orderItem.findMany({
      where: { orderId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum.add(item.lineSubtotal),
      ZERO
    );

    const itemDiscount = items.reduce(
      (sum, item) => sum.add(item.lineDiscountTotal),
      ZERO
    );

    const discountAggregate = await tx.orderDiscount.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });

    const orderDiscount =
      discountAggregate._sum.amount !== null &&
      discountAggregate._sum.amount !== undefined
        ? money(discountAggregate._sum.amount)
        : ZERO;
    const discountTotal = itemDiscount.add(orderDiscount);
    const totalDue = subtotal.sub(discountTotal);

    // Update order with recalculated totals
    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        discountTotal,
        totalDue,
      },
    });

    const inventoryAdjustments = await collectInventoryAdjustments(
      tx,
      items,
      -1
    );

    const { entries, totalApplied, totalTendered } =
      await prepareFinalizePayments(tx, input.payments);

    if (totalApplied.lessThan(totalDue)) {
      throw new HttpError(
        400,
        "Total payments must be equal to or greater than the amount due."
      );
    }

    await tx.payment.deleteMany({ where: { orderId } });

    for (const payment of entries) {
      await tx.payment.create({
        data: {
          orderId,
          method: payment.method,
          amount: payment.amount,
          tenderedAmount: payment.tenderedAmount,
          changeGiven: payment.changeGiven,
          externalReference: payment.externalReference,
          processedByUserId: payment.processedByUserId,
        },
      });
    }

    await applyInventoryAdjustments(tx, inventoryAdjustments);

    const changeDue = totalTendered.sub(totalDue);
    const normalizedChangeDue = changeDue.lessThan(ZERO) ? ZERO : changeDue;

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        totalPaid: totalApplied,
        changeDue: normalizedChangeDue,
      },
      include: ORDER_INCLUDE,
    });

    return mapOrder(updated);
  });

export const voidOrder = async (orderId: string): Promise<OrderResponse> =>
  prisma.$transaction(async (tx) => {
    const order = await fetchOrderWithRelationsOrThrow(tx, orderId);

    if (order.status === OrderStatus.VOID) {
      return mapOrder(order);
    }

    if (order.status === OrderStatus.PAID) {
      throw new HttpError(
        409,
        "Paid orders must be refunded instead of voided."
      );
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new HttpError(409, "Refunded orders cannot be voided.");
    }

    await tx.payment.deleteMany({ where: { orderId } });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.VOID,
        totalPaid: ZERO,
        changeDue: ZERO,
      },
      include: ORDER_INCLUDE,
    });

    return mapOrder(updated);
  });

export const refundOrder = async (
  orderId: string,
  input: RefundOrderInput
): Promise<OrderResponse> =>
  prisma.$transaction(async (tx) => {
    const order = await fetchOrderWithRelationsOrThrow(tx, orderId);

    if (order.status !== OrderStatus.PAID) {
      throw new HttpError(409, "Only paid orders can be refunded.");
    }

    const restockInventory = input.restock ?? true;
    const inventoryAdjustments = restockInventory
      ? await collectInventoryAdjustments(tx, order.items, 1)
      : [];

    const { entries, totalRefund } = await prepareRefundPayments(
      tx,
      input.payments
    );

    const totalPaid = money(order.totalPaid);

    if (!totalRefund.equals(totalPaid)) {
      throw new HttpError(
        400,
        "Refund payments must match the total amount previously paid on the order."
      );
    }

    if (restockInventory) {
      await applyInventoryAdjustments(tx, inventoryAdjustments);
    }

    for (const payment of entries) {
      await tx.payment.create({
        data: {
          orderId,
          method: payment.method,
          amount: payment.amount,
          tenderedAmount: null,
          changeGiven: null,
          externalReference: payment.externalReference,
          processedByUserId: payment.processedByUserId,
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.REFUNDED,
        totalPaid: ZERO,
        changeDue: ZERO,
      },
      include: ORDER_INCLUDE,
    });

    return mapOrder(updated);
  });

export const getOrderSummary = async (
  orderId: string
): Promise<OrderSummaryResponse> => {
  const orderRecord = await fetchOrderWithRelationsOrThrow(prisma, orderId);
  const order = mapOrder(orderRecord);
  const balanceDueDecimal = money(orderRecord.totalDue).sub(
    orderRecord.totalPaid
  );
  const normalizedBalance =
    balanceDueDecimal.lessThan(ZERO) && !balanceDueDecimal.equals(ZERO)
      ? ZERO
      : balanceDueDecimal;

  return {
    order,
    totals: {
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      totalDue: order.totalDue,
      totalPaid: order.totalPaid,
      changeDue: order.changeDue,
      balanceDue: toNumber(normalizedBalance),
    },
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    paymentCount: order.payments.length,
  };
};

export const getOrderReceipt = async (
  orderId: string
): Promise<OrderReceiptResponse> => {
  const summary = await getOrderSummary(orderId);

  const cashier = await prisma.user.findUnique({
    where: { id: summary.order.cashierId },
    include: { profile: true },
  });

  const cashierName =
    cashier?.name?.trim() && cashier.name.trim().length > 0
      ? cashier.name.trim()
      : summary.order.cashierId;

  const details: OrderReceiptDetails = {
    orderNumber: summary.order.orderNumber,
    createdAt: summary.order.createdAt,
    status: summary.order.status,
    cashierId: summary.order.cashierId,
    cashierName,
    items: summary.order.items,
    discounts: summary.order.discounts,
    payments: summary.order.payments,
    totals: summary.totals,
  };

  const printable = buildReceipt({
    receipt: details,
    cashierName,
    businessProfile: cashier?.profile ?? null,
  });

  return {
    ...details,
    printable,
  };
};

export const getCheckoutConfig = async (): Promise<CheckoutConfigResponse> => {
  const discountTypes = await prisma.discountType.findMany({
    orderBy: { createdAt: "desc" },
  });

  const paymentMethods = (Object.values(PaymentMethod) as PaymentMethod[]).map(
    (method) => ({
      value: method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
    })
  );

  return {
    paymentMethods,
    discountTypes: discountTypes.map((discountType) => ({
      id: discountType.id,
      name: discountType.name,
      type: discountType.type,
      value: toNumber(discountType.value),
      scope: discountType.scope,
      requiresManagerPin: discountType.requiresManagerPin,
    })),
  };
};

const ensureOrderExists = async (id: string) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new HttpError(404, "Order not found.");
  }
  return order;
};

const ensureOrderItemBelongs = async (orderId: string, itemId: string) => {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
  });

  if (!item || item.orderId !== orderId) {
    throw new HttpError(404, "Order item not found.");
  }
  return item;
};

export const addOrderItem = async (
  orderId: string,
  input: OrderItemInput
): Promise<OrderResponse> => {
  await ensureOrderExists(orderId);

  if (!input.nameSnapshot?.trim()) {
    throw new HttpError(400, "Item name is required.");
  }

  const qty = input.qty;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new HttpError(400, "Quantity must be a positive integer.");
  }

  const unitPrice = money(input.unitPrice);
  const discount = input.lineDiscountTotal
    ? money(input.lineDiscountTotal)
    : ZERO;
  const lineSubtotal = unitPrice.mul(qty);
  const lineTotal = lineSubtotal.sub(discount);

  await prisma.orderItem.create({
    data: {
      orderId,
      productId: input.productId ?? null,
      nameSnapshot: input.nameSnapshot.trim(),
      notes: input.notes ?? null,
      qty,
      unitPrice,
      lineSubtotal,
      lineDiscountTotal: discount,
      lineTotal,
    },
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export const updateOrderItem = async (
  orderId: string,
  itemId: string,
  input: OrderItemUpdateInput
): Promise<OrderResponse> => {
  const existing = await ensureOrderItemBelongs(orderId, itemId);

  const updatedQty = input.qty !== undefined ? input.qty : existing.qty;
  if (!Number.isInteger(updatedQty) || updatedQty <= 0) {
    throw new HttpError(400, "Quantity must be a positive integer.");
  }

  const updatedName =
    input.nameSnapshot !== undefined
      ? input.nameSnapshot.trim()
      : existing.nameSnapshot;

  if (!updatedName) {
    throw new HttpError(400, "Item name cannot be empty.");
  }

  const existingUnitPrice = money(existing.unitPrice);
  const existingDiscount = money(existing.lineDiscountTotal);

  const updatedUnitPrice =
    input.unitPrice !== undefined ? money(input.unitPrice) : existingUnitPrice;
  const updatedDiscount =
    input.lineDiscountTotal !== undefined
      ? money(input.lineDiscountTotal)
      : existingDiscount;

  const lineSubtotal = updatedUnitPrice.mul(updatedQty);
  const lineTotal = lineSubtotal.sub(updatedDiscount);

  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      productId: input.productId ?? existing.productId,
      nameSnapshot: updatedName,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      qty: updatedQty,
      unitPrice: updatedUnitPrice,
      lineDiscountTotal: updatedDiscount,
      lineSubtotal,
      lineTotal,
    },
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export const removeOrderItem = async (
  orderId: string,
  itemId: string
): Promise<OrderResponse> => {
  await ensureOrderItemBelongs(orderId, itemId);

  await prisma.orderItem.delete({
    where: { id: itemId },
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export type ApplyOrderDiscountInput = {
  discountTypeId: string;
  appliedByUserId: string;
  approvedByManagerId?: string;
  amount?: Decimalish;
};

export type UpdateOrderDiscountInput = {
  amount?: Decimalish;
  approvedByManagerId?: string | null;
};

const ensureDiscountTypeExists = async (discountTypeId: string) => {
  const discountType = await prisma.discountType.findUnique({
    where: { id: discountTypeId },
  });

  if (!discountType) {
    throw new HttpError(404, "Discount type not found.");
  }

  return discountType;
};

const ensureManagerApprovalIfRequired = async (
  discountType: Prisma.DiscountTypeGetPayload<Record<string, never>>,
  approvedByManagerId?: string
) => {
  if (!discountType.requiresManagerPin) {
    return;
  }

  if (!approvedByManagerId) {
    throw new HttpError(400, "Manager approval is required for this discount.");
  }

  const manager = await ensureUserExists(approvedByManagerId);
  if (
    manager.role !== UserRole.MANAGER &&
    manager.role !== UserRole.ADMIN &&
    manager.role !== UserRole.SUPER_ADMIN
  ) {
    throw new HttpError(
      403,
      "Only managers, admins, or super admins can approve this discount."
    );
  }
};

const ensureDiscountBelongsToOrder = async (
  orderId: string,
  discountId: string
) => {
  const discount = await prisma.orderDiscount.findUnique({
    where: { id: discountId },
  });

  if (!discount || discount.orderId !== orderId) {
    throw new HttpError(404, "Order discount not found.");
  }

  return discount;
};

export const applyOrderDiscount = async (
  orderId: string,
  input: ApplyOrderDiscountInput
): Promise<OrderResponse> => {
  const order = await ensureOrderExists(orderId);
  const discountType = await ensureDiscountTypeExists(input.discountTypeId);

  if (discountType.scope !== DiscountScope.ORDER) {
    throw new HttpError(
      400,
      "This discount type must be applied to an order item."
    );
  }

  await ensureUserExists(input.appliedByUserId);
  await ensureManagerApprovalIfRequired(
    discountType,
    input.approvedByManagerId
  );

  const subtotal = money(order.subtotal);
  const currentDiscountTotal = money(order.discountTotal);
  const base = subtotal.sub(currentDiscountTotal);
  const normalizedBase = base.lessThan(ZERO) ? ZERO : base;

  const computedAmount =
    input.amount !== undefined
      ? money(input.amount)
      : discountType.type === DiscountTypeKind.PERCENT
      ? normalizedBase.mul(discountType.value).div(100)
      : money(discountType.value);

  const amount = computedAmount.lessThan(ZERO)
    ? ZERO
    : computedAmount.greaterThan(normalizedBase)
    ? normalizedBase
    : computedAmount;

  await prisma.orderDiscount.create({
    data: {
      orderId,
      discountTypeId: input.discountTypeId,
      amount,
      appliedByUserId: input.appliedByUserId,
      approvedByManagerId: input.approvedByManagerId ?? null,
    },
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export const updateOrderDiscount = async (
  orderId: string,
  discountId: string,
  input: UpdateOrderDiscountInput
): Promise<OrderResponse> => {
  const existing = await ensureDiscountBelongsToOrder(orderId, discountId);

  const data: Prisma.OrderDiscountUncheckedUpdateInput = {};

  if (input.amount !== undefined) {
    data.amount = money(input.amount);
  }

  if (input.approvedByManagerId !== undefined) {
    if (input.approvedByManagerId) {
      await ensureManagerApprovalIfRequired(
        await ensureDiscountTypeExists(existing.discountTypeId),
        input.approvedByManagerId
      );
      data.approvedByManagerId = input.approvedByManagerId;
    } else {
      data.approvedByManagerId = null;
    }
  }

  await prisma.orderDiscount.update({
    where: { id: discountId },
    data,
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export const removeOrderDiscount = async (
  orderId: string,
  discountId: string
): Promise<OrderResponse> => {
  await ensureDiscountBelongsToOrder(orderId, discountId);

  await prisma.orderDiscount.delete({
    where: { id: discountId },
  });

  await recalculateOrderTotals(orderId);
  return getOrderById(orderId);
};

export type CreateAndFinalizeOrderInput = {
  cashierId: string;
  items: OrderItemInput[];
  payments: PaymentInput[];
};

export type CreateAndFinalizeOrderResponse = {
  order: OrderResponse;
  receipt: OrderReceiptResponse;
};

export const createAndFinalizeOrder = async (
  input: CreateAndFinalizeOrderInput
): Promise<CreateAndFinalizeOrderResponse> => {
  // Pre-fetch cashier outside transaction to reduce transaction time
  const cashier = await prisma.user.findUnique({
    where: { id: input.cashierId },
    include: { profile: true },
  });

  if (!cashier) {
    throw new HttpError(404, "Cashier not found.");
  }

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new HttpError(400, "At least one item is required.");
  }

  for (const item of input.items) {
    if (!item.nameSnapshot?.trim()) {
      throw new HttpError(400, "Item name is required.");
    }
    const qty = item.qty;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new HttpError(400, "Quantity must be a positive integer.");
    }
  }

  // Validate payments
  if (!input.payments || input.payments.length === 0) {
    throw new HttpError(400, "At least one payment is required.");
  }

  // Prepare order items data for batch insert
  const itemsData = input.items.map((itemInput) => {
    const unitPrice = money(itemInput.unitPrice);
    const discount = itemInput.lineDiscountTotal
      ? money(itemInput.lineDiscountTotal)
      : ZERO;
    const lineSubtotal = unitPrice.mul(itemInput.qty);
    const lineTotal = lineSubtotal.sub(discount);

    return {
      productId: itemInput.productId ?? null,
      nameSnapshot: itemInput.nameSnapshot.trim(),
      notes: itemInput.notes ?? null,
      qty: itemInput.qty,
      unitPrice,
      lineSubtotal,
      lineDiscountTotal: discount,
      lineTotal,
    };
  });

  return prisma.$transaction(async (tx) => {
    // Step 1: Create order
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        cashierId: input.cashierId,
        status: OrderStatus.OPEN, // Will be updated to PAID at the end
        subtotal: ZERO,
        discountTotal: ZERO,
        totalDue: ZERO,
        totalPaid: ZERO,
        changeDue: ZERO,
      },
    });

    // Step 2: Batch create all items at once
    const itemsWithOrderId = itemsData.map((item) => ({
      ...item,
      orderId: order.id,
    }));

    await tx.orderItem.createMany({
      data: itemsWithOrderId,
    });

    // Fetch created items for calculations
    const orderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
    });

    // Step 3: Calculate totals
    const subtotal = orderItems.reduce(
      (sum, item) => sum.add(item.lineSubtotal),
      ZERO
    );

    const itemDiscount = orderItems.reduce(
      (sum, item) => sum.add(item.lineDiscountTotal),
      ZERO
    );

    // No order-level discounts in this flow (can be added later if needed)
    const discountTotal = itemDiscount;
    const totalDue = subtotal.sub(discountTotal);

    // Step 4: Prepare payments
    const { entries, totalApplied, totalTendered } =
      await prepareFinalizePayments(tx, input.payments);

    if (totalApplied.lessThan(totalDue)) {
      throw new HttpError(
        400,
        "Total payments must be equal to or greater than the amount due."
      );
    }

    // Step 5: Process inventory adjustments
    const inventoryAdjustments = await collectInventoryAdjustments(
      tx,
      orderItems,
      -1
    );

    // Step 6: Batch create all payments at once
    const paymentsData = entries.map((payment) => ({
      orderId: order.id,
      method: payment.method,
      amount: payment.amount,
      tenderedAmount: payment.tenderedAmount,
      changeGiven: payment.changeGiven,
      externalReference: payment.externalReference,
      processedByUserId: payment.processedByUserId,
    }));

    await tx.payment.createMany({
      data: paymentsData,
    });

    // Step 7: Apply inventory adjustments
    await applyInventoryAdjustments(tx, inventoryAdjustments);

    // Step 8: Finalize order (update status to PAID)
    const changeDue = totalTendered.sub(totalDue);
    const normalizedChangeDue = changeDue.lessThan(ZERO) ? ZERO : changeDue;

    const finalizedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        subtotal,
        discountTotal,
        totalDue,
        totalPaid: totalApplied,
        changeDue: normalizedChangeDue,
      },
      include: ORDER_INCLUDE,
    });

    const orderResponse = mapOrder(finalizedOrder);

    // Step 9: Build receipt (cashier already fetched outside transaction)
    const cashierName =
      cashier?.name?.trim() && cashier.name.trim().length > 0
        ? cashier.name.trim()
        : input.cashierId;

    const receiptDetails: OrderReceiptDetails = {
      orderNumber: orderResponse.orderNumber,
      createdAt: orderResponse.createdAt,
      status: orderResponse.status,
      cashierId: orderResponse.cashierId,
      cashierName,
      items: orderResponse.items,
      discounts: orderResponse.discounts,
      payments: orderResponse.payments,
      totals: {
        subtotal: orderResponse.subtotal,
        discountTotal: orderResponse.discountTotal,
        totalDue: orderResponse.totalDue,
        totalPaid: orderResponse.totalPaid,
        changeDue: orderResponse.changeDue,
        balanceDue: 0, // Already paid
      },
    };

    const printable = buildReceipt({
      receipt: receiptDetails,
      cashierName,
      businessProfile: cashier?.profile ?? null,
    });

    const receipt: OrderReceiptResponse = {
      ...receiptDetails,
      printable,
    };

    return {
      order: orderResponse,
      receipt,
    };
  });
};
