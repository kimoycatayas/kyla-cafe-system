import { randomUUID } from "node:crypto";

type ProfileRecord = {
  id: string;
  userId: string;
  businessName: string;
  industry: string | null;
  fullName: string | null;
  contactNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  profile?: ProfileRecord | null;
};

type RefreshTokenRecord = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
};

type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  price: string;
  cost: string;
  barcode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryRecord = {
  id: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
};

type DiscountTypeRecord = {
  id: string;
  name: string;
  type: string;
  value: string;
  scope: string;
  requiresManagerPin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OrderDiscountRecord = {
  id: string;
  orderId: string;
  discountTypeId: string;
  amount: string;
  appliedByUserId: string;
  approvedByManagerId: string | null;
  createdAt: Date;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  cashierId: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  totalDue: string;
  totalPaid: string;
  changeDue: string;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string | null;
  nameSnapshot: string;
  notes: string | null;
  qty: number;
  unitPrice: string;
  lineSubtotal: string;
  lineDiscountTotal: string;
  lineTotal: string;
};

type PaymentRecord = {
  id: string;
  orderId: string;
  method: string;
  amount: string;
  tenderedAmount: string | null;
  changeGiven: string | null;
  externalReference: string | null;
  processedByUserId: string;
  createdAt: Date;
};

type FindUniqueArgs<T> = {
  where: Partial<T>;
  include?: Record<string, unknown>;
};

const clone = <T>(value: T): T => structuredClone(value);

const asString = (value: unknown, fallback: string): string => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    typeof value === "object" &&
    "set" in (value as Record<string, unknown>)
  ) {
    return asString((value as Record<string, unknown>).set, fallback);
  }

  return String(value);
};

type OrderRelationsInclude = {
  items?: boolean;
  discounts?:
    | boolean
    | {
        include?: {
          discountType?: boolean;
        };
      };
  payments?: boolean;
};

export const createTestPrisma = () => {
  const users = new Map<string, UserRecord>();
  const refreshTokens = new Map<string, RefreshTokenRecord>();
  const products = new Map<string, ProductRecord>();
  const inventory = new Map<string, InventoryRecord>();
  const discountTypes = new Map<string, DiscountTypeRecord>();
  const orderDiscounts = new Map<string, OrderDiscountRecord>();
  const orders = new Map<string, OrderRecord>();
  const orderItems = new Map<string, OrderItemRecord>();
  const payments = new Map<string, PaymentRecord>();

  const findUserByEmail = (email: string): UserRecord | undefined =>
    [...users.values()].find((user) => user.email === email);

  const findRefreshTokenById = (id: string): RefreshTokenRecord | undefined =>
    refreshTokens.get(id);

  const withProfile = (user: UserRecord, include?: { profile?: boolean }) => {
    if (!include?.profile) {
      const { profile: _, ...rest } = user;
      return clone(rest);
    }

    return clone(user);
  };

  const attachUserToRefreshToken = (
    token: RefreshTokenRecord,
    include:
      | undefined
      | {
          user?: {
            include?: {
              profile?: boolean;
            };
          };
        }
  ) => {
    if (!include?.user) {
      return clone(token);
    }

    const user = users.get(token.userId);

    return {
      ...clone(token),
      user: user ? withProfile(user, include.user.include) : null,
    };
  };

  const attachOrderRelations = (
    orderId: string,
    include: OrderRelationsInclude | undefined,
    payload: Record<string, unknown>,
  ) => {
    if (!include) {
      return payload;
    }

    if (include.items) {
      payload.items = [...orderItems.values()].filter(
        (item) => item.orderId === orderId,
      );
    }

    if (include.discounts) {
      const includeArg =
        typeof include.discounts === "object" ? include.discounts : undefined;
      const includeDiscountType =
        includeArg?.include &&
        typeof includeArg.include === "object" &&
        (includeArg.include as { discountType?: boolean }).discountType;

      payload.discounts = [...orderDiscounts.values()]
        .filter((discount) => discount.orderId === orderId)
        .map((discount) => {
          const discountPayload = structuredClone(
            discount,
          ) as Record<string, unknown>;

          if (includeDiscountType) {
            const discountType = discountTypes.get(discount.discountTypeId);
            discountPayload.discountType = discountType
              ? structuredClone(discountType)
              : null;
          }

          return discountPayload;
        });
    }

    if (include.payments) {
      payload.payments = [...payments.values()]
        .filter((payment) => payment.orderId === orderId)
        .map((payment) => structuredClone(payment));
    }

    return payload;
  };

  const buildClient = (): any => {
    const client: any = {
      user: {
        findUnique: async ({ where, include }: FindUniqueArgs<UserRecord>) => {
          let user: UserRecord | undefined;

          if (where.id) {
            user = users.get(where.id);
          } else if (where.email) {
            user = findUserByEmail(where.email);
          }

          return user
            ? withProfile(user, include as { profile?: boolean })
            : null;
        },
        create: async ({
          data,
          include,
        }: {
          data: {
            email: string;
            passwordHash: string;
            name?: string;
            role?: string;
            profile?: {
              create: Omit<
                ProfileRecord,
                "id" | "userId" | "createdAt" | "updatedAt"
              >;
            };
          };
          include?: { profile?: boolean };
        }) => {
          const id = randomUUID();
          const createdAt = new Date();
          const updatedAt = createdAt;

          const user: UserRecord = {
            id,
            email: data.email,
            passwordHash: data.passwordHash,
            name: data.name ?? "",
            role: data.role ?? "CASHIER",
            createdAt,
            updatedAt,
          };

          if (data.profile?.create) {
            const profile: ProfileRecord = {
              id: randomUUID(),
              userId: id,
              businessName: data.profile.create.businessName,
              industry: data.profile.create.industry ?? null,
              fullName: data.profile.create.fullName ?? null,
              contactNumber: data.profile.create.contactNumber ?? null,
              createdAt,
              updatedAt,
            };

            user.profile = profile;
          }

          users.set(id, user);

          return withProfile(user, include);
        },
      },
      product: {
        create: async ({
          data,
        }: {
          data: {
            name: string;
            sku: string;
            price: { toString(): string };
            cost: { toString(): string };
            barcode?: string | null;
          };
        }) => {
          const offset = products.size;
          const now = new Date(Date.now() + offset);
          const id = randomUUID();

          const record: ProductRecord = {
            id,
            name: data.name,
            sku: data.sku,
            price: data.price.toString(),
            cost: data.cost.toString(),
            barcode: data.barcode ?? null,
            createdAt: now,
            updatedAt: now,
          };

          products.set(id, record);
          return structuredClone(record);
        },
        findMany: async () =>
          [...products.values()]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((product) => structuredClone(product)),
        findUnique: async ({ where }: { where: Partial<ProductRecord> }) => {
          let product: ProductRecord | undefined;

          if (where.id) {
            product = products.get(where.id);
          } else if (where.sku) {
            product = [...products.values()].find(
              (item) => item.sku === where.sku
            );
          }

          return product ? structuredClone(product) : null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<{
            name: string;
            sku: string;
            price: { toString(): string };
            cost: { toString(): string };
            barcode: string | null;
          }>;
        }) => {
          const existing = products.get(where.id);

          if (!existing) {
            throw new Error("Product not found");
          }

          const updated: ProductRecord = {
            ...existing,
            name: data.name ?? existing.name,
            sku: data.sku ?? existing.sku,
            price: data.price ? data.price.toString() : existing.price,
            cost: data.cost ? data.cost.toString() : existing.cost,
            barcode:
              data.barcode !== undefined
                ? data.barcode ?? null
                : existing.barcode,
            updatedAt: new Date(Date.now() + products.size),
          };

          products.set(where.id, updated);
          return structuredClone(updated);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = products.get(where.id);
          if (!existing) {
            throw new Error("Product not found");
          }
          products.delete(where.id);
          return structuredClone(existing);
        },
      },
      inventory: {
        create: async ({
          data,
          include,
        }: {
          data: {
            productId: string;
            quantity: number;
            lowStockThreshold: number;
          };
          include?: { product?: boolean };
        }) => {
          const id = randomUUID();
          const now = new Date(Date.now() + inventory.size);
          const record: InventoryRecord = {
            id,
            productId: data.productId,
            quantity: data.quantity,
            lowStockThreshold: data.lowStockThreshold,
            createdAt: now,
            updatedAt: now,
          };

          if (
            [...inventory.values()].some(
              (item) => item.productId === data.productId
            )
          ) {
            const error = new Error("Unique constraint failed");
            // @ts-expect-error - mimic Prisma error surface
            error.code = "P2002";
            throw error;
          }

          inventory.set(id, record);

          const payload = structuredClone(record);
          if (include?.product) {
            const product = products.get(record.productId);
            // @ts-expect-error - dynamic include
            payload.product = structuredClone(product);
          }
          return payload;
        },
        findMany: async ({
          include,
          orderBy,
        }: {
          include?: { product?: boolean };
          orderBy?:
            | Array<Record<string, "asc" | "desc">>
            | Record<string, "asc" | "desc">;
        } = {}) => {
          let records = [...inventory.values()];

          const sorters = Array.isArray(orderBy)
            ? orderBy
            : orderBy
            ? [orderBy]
            : [];

          for (const sorter of sorters.reverse()) {
            const entry = Object.entries(sorter)[0];
            if (!entry) {
              continue;
            }
            const [key, direction] = entry as [
              keyof InventoryRecord,
              "asc" | "desc"
            ];
            records = records.sort((a, b) => {
              const compare = a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0;
              return direction === "asc" ? compare : -compare;
            });
          }

          return records.map((record) => {
            const payload = structuredClone(record);
            if (include?.product) {
              const product = products.get(record.productId);
              // @ts-expect-error - dynamic include
              payload.product = structuredClone(product);
            }
            return payload;
          });
        },
        findUnique: async ({
          where,
          include,
        }: {
          where: Partial<InventoryRecord>;
          include?: { product?: boolean };
        }) => {
          let record: InventoryRecord | undefined;

          if (where.id) {
            record = inventory.get(where.id);
          } else if (where.productId) {
            record = [...inventory.values()].find(
              (item) => item.productId === where.productId
            );
          }

          if (!record) {
            return null;
          }

          const payload = structuredClone(record);
          if (include?.product) {
            const product = products.get(record.productId);
            // @ts-expect-error
            payload.product = structuredClone(product);
          }
          return payload;
        },
        update: async ({
          where,
          data,
          include,
        }: {
          where: { id: string };
          data: Partial<InventoryRecord>;
          include?: { product?: boolean };
        }) => {
          const existing = inventory.get(where.id);
          if (!existing) {
            throw new Error("Inventory not found");
          }

          if (
            data.productId &&
            [...inventory.values()].some(
              (item) =>
                item.productId === data.productId && item.id !== existing.id
            )
          ) {
            const error = new Error("Unique constraint failed");
            // @ts-expect-error
            error.code = "P2002";
            throw error;
          }

          const updated: InventoryRecord = {
            ...existing,
            ...data,
            updatedAt: new Date(Date.now() + inventory.size),
          };

          inventory.set(where.id, updated);
          const payload = structuredClone(updated);
          if (include?.product) {
            const product = products.get(updated.productId);
            // @ts-expect-error
            payload.product = structuredClone(product);
          }

          return payload;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = inventory.get(where.id);
          if (!existing) {
            throw new Error("Inventory not found");
          }
          inventory.delete(where.id);
          return structuredClone(existing);
        },
      },
      discountType: {
        create: async ({
          data,
        }: {
          data: {
            name: string;
            type: string;
            value: { toString(): string };
            scope: string;
            requiresManagerPin?: boolean;
          };
        }) => {
          const id = randomUUID();
          const now = new Date(Date.now() + discountTypes.size);
          const record: DiscountTypeRecord = {
            id,
            name: data.name,
            type: data.type,
            value: data.value.toString(),
            scope: data.scope,
            requiresManagerPin: Boolean(data.requiresManagerPin),
            createdAt: now,
            updatedAt: now,
          };

          discountTypes.set(id, record);
          return structuredClone(record);
        },
        findMany: async () =>
          [...discountTypes.values()]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((record) => structuredClone(record)),
        findUnique: async ({
          where,
        }: {
          where: Partial<DiscountTypeRecord>;
        }) => {
          if (where.id) {
            const record = discountTypes.get(where.id);
            return record ? structuredClone(record) : null;
          }
          return null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<{
            name: string;
            type: string;
            value: { toString(): string };
            scope: string;
            requiresManagerPin: boolean;
          }>;
        }) => {
          const existing = discountTypes.get(where.id);
          if (!existing) {
            throw new Error("Discount type not found");
          }

          const updated: DiscountTypeRecord = {
            ...existing,
            name: data.name ?? existing.name,
            type: data.type ?? existing.type,
            value: data.value ? data.value.toString() : existing.value,
            scope: data.scope ?? existing.scope,
            requiresManagerPin:
              data.requiresManagerPin ?? existing.requiresManagerPin,
            updatedAt: new Date(Date.now() + discountTypes.size),
          };

          discountTypes.set(where.id, updated);
          return structuredClone(updated);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = discountTypes.get(where.id);
          if (!existing) {
            throw new Error("Discount type not found");
          }

          discountTypes.delete(where.id);
          return structuredClone(existing);
        },
        count: async ({
          where,
        }: { where?: Partial<DiscountTypeRecord> } = {}) => {
          if (!where) {
            return discountTypes.size;
          }

          return [...discountTypes.values()].filter((record) =>
            Object.entries(where).every(
              ([key, value]) =>
                record[key as keyof DiscountTypeRecord] === value
            )
          ).length;
        },
      },
      orderDiscount: {
        create: async ({
          data,
        }: {
          data: {
            orderId: string;
            discountTypeId: string;
            amount: { toString(): string };
            appliedByUserId: string;
            approvedByManagerId?: string | null;
          };
        }) => {
          const id = randomUUID();
          const now = new Date(Date.now() + orderDiscounts.size);
          const record: OrderDiscountRecord = {
            id,
            orderId: data.orderId,
            discountTypeId: data.discountTypeId,
            amount: data.amount.toString(),
            appliedByUserId: data.appliedByUserId,
            approvedByManagerId: data.approvedByManagerId ?? null,
            createdAt: now,
          };

          orderDiscounts.set(id, record);
          return structuredClone(record);
        },
        findUnique: async ({
          where,
        }: {
          where: Partial<OrderDiscountRecord>;
        }) => {
          if (where.id) {
            const record = orderDiscounts.get(where.id);
            return record ? structuredClone(record) : null;
          }

          return null;
        },
        findMany: async ({
          where,
        }: {
          where?: Partial<OrderDiscountRecord>;
        } = {}) =>
          [...orderDiscounts.values()]
            .filter((record) =>
              where
                ? Object.entries(where).every(
                    ([key, value]) =>
                      record[key as keyof OrderDiscountRecord] === value,
                  )
                : true,
            )
            .map((record) => structuredClone(record)),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<OrderDiscountRecord>;
        }) => {
          const existing = orderDiscounts.get(where.id);
          if (!existing) {
            throw new Error("Order discount not found");
          }

          const updated: OrderDiscountRecord = {
            ...existing,
            amount: asString(data.amount, existing.amount),
            appliedByUserId:
              data.appliedByUserId ?? existing.appliedByUserId,
            approvedByManagerId:
              data.approvedByManagerId !== undefined
                ? data.approvedByManagerId ?? null
                : existing.approvedByManagerId,
          };

          orderDiscounts.set(where.id, updated);
          return structuredClone(updated);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = orderDiscounts.get(where.id);
          if (!existing) {
            throw new Error("Order discount not found");
          }
          orderDiscounts.delete(where.id);
          return structuredClone(existing);
        },
        count: async ({
          where,
        }: {
          where?: Partial<OrderDiscountRecord>;
        } = {}) => {
          if (!where) {
            return orderDiscounts.size;
          }

          return [...orderDiscounts.values()].filter((record) =>
            Object.entries(where).every(
              ([key, value]) =>
                record[key as keyof OrderDiscountRecord] === value
            )
          ).length;
        },
        deleteMany: async ({
          where,
        }: {
          where?: Partial<OrderDiscountRecord>;
        } = {}) => {
          let deleted = 0;
          for (const [id, record] of [...orderDiscounts.entries()]) {
            const matches = where
              ? Object.entries(where).every(
                  ([key, value]) =>
                    record[key as keyof OrderDiscountRecord] === value
                )
              : true;
            if (matches) {
              orderDiscounts.delete(id);
              deleted += 1;
            }
          }

          return { count: deleted };
        },
        aggregate: async ({
          where,
        }: {
          where?: Partial<OrderDiscountRecord>;
          _sum: { amount: true };
        }) => {
          const filtered = [...orderDiscounts.values()].filter((record) =>
            where
              ? Object.entries(where).every(
                  ([key, value]) =>
                    record[key as keyof OrderDiscountRecord] === value
                )
              : true
          );

          const amount = filtered.reduce(
            (sum, record) => sum + Number(record.amount),
            0
          );

          return { _sum: { amount } };
        },
      },
      order: {
        create: async ({
          data,
          include,
        }: {
          data: {
            orderNumber: string;
            cashierId: string;
            status: string;
            subtotal: { toString(): string };
            discountTotal: { toString(): string };
            totalDue: { toString(): string };
            totalPaid: { toString(): string };
            changeDue: { toString(): string };
          };
          include?: OrderRelationsInclude;
        }) => {
          const id = randomUUID();
          const now = new Date(Date.now() + orders.size);
          const record: OrderRecord = {
            id,
            orderNumber: data.orderNumber,
            cashierId: data.cashierId,
            status: data.status,
            subtotal: data.subtotal.toString(),
            discountTotal: data.discountTotal.toString(),
            totalDue: data.totalDue.toString(),
            totalPaid: data.totalPaid.toString(),
            changeDue: data.changeDue.toString(),
            createdAt: now,
            updatedAt: now,
          };

          orders.set(id, record);
          const payload = structuredClone(record) as Record<string, unknown>;
          attachOrderRelations(id, include, payload);
          return payload;
        },
        findUnique: async ({
          where,
          include,
        }: {
          where: Partial<OrderRecord>;
          include?: OrderRelationsInclude;
        }) => {
          const record = where.id ? orders.get(where.id) : undefined;
          if (!record) {
            return null;
          }

          const payload = structuredClone(record) as Record<string, unknown>;
          attachOrderRelations(record.id, include, payload);
          return payload;
        },
        findMany: async ({
          include,
        }: {
          include?: OrderRelationsInclude;
        } = {}) =>
          [...orders.values()]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((record) => {
              const payload = structuredClone(record) as Record<
                string,
                unknown
              >;
              attachOrderRelations(record.id, include, payload);
              return payload;
            }),
        update: async ({
          where,
          data,
          include,
        }: {
          where: { id: string };
          data: Partial<OrderRecord>;
          include?: OrderRelationsInclude;
        }) => {
          const existing = orders.get(where.id);
          if (!existing) {
            throw new Error("Order not found");
          }

          const updated: OrderRecord = {
            ...existing,
            orderNumber:
              (data.orderNumber as string | undefined) ?? existing.orderNumber,
            cashierId:
              (data.cashierId as string | undefined) ?? existing.cashierId,
            status: (data.status as string | undefined) ?? existing.status,
            subtotal: asString(data.subtotal, existing.subtotal),
            discountTotal: asString(data.discountTotal, existing.discountTotal),
            totalDue: asString(data.totalDue, existing.totalDue),
            totalPaid: asString(data.totalPaid, existing.totalPaid),
            changeDue: asString(data.changeDue, existing.changeDue),
            createdAt: existing.createdAt,
            updatedAt: new Date(Date.now() + orders.size),
          };

          orders.set(where.id, updated);
          const payload = structuredClone(updated) as Record<string, unknown>;
          attachOrderRelations(updated.id, include, payload);
          return payload;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = orders.get(where.id);
          if (!existing) {
            throw new Error("Order not found");
          }
          orders.delete(where.id);
          for (const [id, item] of [...orderItems.entries()]) {
            if (item.orderId === where.id) {
              orderItems.delete(id);
            }
          }
          for (const [id, discount] of [...orderDiscounts.entries()]) {
            if (discount.orderId === where.id) {
              orderDiscounts.delete(id);
            }
          }
          for (const [id, payment] of [...payments.entries()]) {
            if (payment.orderId === where.id) {
              payments.delete(id);
            }
          }
          return structuredClone(existing);
        },
      },
      orderItem: {
        create: async ({
          data,
        }: {
          data: {
            orderId: string;
            productId?: string | null;
            nameSnapshot: string;
            notes?: string | null;
            qty: number;
            unitPrice: { toString(): string };
            lineSubtotal: { toString(): string };
            lineDiscountTotal: { toString(): string };
            lineTotal: { toString(): string };
          };
        }) => {
          const id = randomUUID();
          const record: OrderItemRecord = {
            id,
            orderId: data.orderId,
            productId: data.productId ?? null,
            nameSnapshot: data.nameSnapshot,
            notes: data.notes ?? null,
            qty: data.qty,
            unitPrice: data.unitPrice.toString(),
            lineSubtotal: data.lineSubtotal.toString(),
            lineDiscountTotal: data.lineDiscountTotal.toString(),
            lineTotal: data.lineTotal.toString(),
          };

          orderItems.set(id, record);
          return structuredClone(record);
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<OrderItemRecord>;
        }) => {
          const existing = orderItems.get(where.id);
          if (!existing) {
            throw new Error("Order item not found");
          }

          const updated: OrderItemRecord = {
            ...existing,
            productId:
              data.productId !== undefined
                ? data.productId ?? null
                : existing.productId,
            nameSnapshot:
              (data.nameSnapshot as string | undefined) ??
              existing.nameSnapshot,
            notes: (data.notes as string | null | undefined) ?? existing.notes,
            qty: (data.qty as number | undefined) ?? existing.qty,
            unitPrice: asString(data.unitPrice, existing.unitPrice),
            lineSubtotal: asString(data.lineSubtotal, existing.lineSubtotal),
            lineDiscountTotal: asString(
              data.lineDiscountTotal,
              existing.lineDiscountTotal
            ),
            lineTotal: asString(data.lineTotal, existing.lineTotal),
          };

          orderItems.set(where.id, updated);
          return structuredClone(updated);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = orderItems.get(where.id);
          if (!existing) {
            throw new Error("Order item not found");
          }
          orderItems.delete(where.id);
          return structuredClone(existing);
        },
        findUnique: async ({ where }: { where: Partial<OrderItemRecord> }) => {
          if (where.id) {
            const record = orderItems.get(where.id);
            return record ? structuredClone(record) : null;
          }
          return null;
        },
        findMany: async ({ where }: { where: Partial<OrderItemRecord> }) =>
          [...orderItems.values()].filter((item) =>
            Object.entries(where).every(
              ([key, value]) => item[key as keyof OrderItemRecord] === value
            )
          ),
      },
      payment: {
        create: async ({
          data,
        }: {
          data: {
            orderId: string;
            method: string;
            amount: { toString(): string };
            tenderedAmount?: { toString(): string } | null;
            changeGiven?: { toString(): string } | null;
            externalReference?: string | null;
            processedByUserId: string;
          };
        }) => {
          const id = randomUUID();
          const now = new Date(Date.now() + payments.size);
          const record: PaymentRecord = {
            id,
            orderId: data.orderId,
            method: data.method,
            amount: data.amount.toString(),
            tenderedAmount: data.tenderedAmount
              ? data.tenderedAmount.toString()
              : null,
            changeGiven: data.changeGiven
              ? data.changeGiven.toString()
              : null,
            externalReference: data.externalReference ?? null,
            processedByUserId: data.processedByUserId,
            createdAt: now,
          };

          payments.set(id, record);
          return structuredClone(record);
        },
        deleteMany: async ({
          where,
        }: {
          where?: Partial<PaymentRecord>;
        } = {}) => {
          let count = 0;
          for (const [id, record] of [...payments.entries()]) {
            const matches = where
              ? Object.entries(where).every(
                  ([key, value]) =>
                    record[key as keyof PaymentRecord] === value
                )
              : true;

            if (matches) {
              payments.delete(id);
              count += 1;
            }
          }

          return { count };
        },
        findMany: async ({
          where,
        }: {
          where?: Partial<PaymentRecord>;
        } = {}) =>
          [...payments.values()].filter((record) =>
            where
              ? Object.entries(where).every(
                  ([key, value]) =>
                    record[key as keyof PaymentRecord] === value
                )
              : true
          ),
      },
      refreshToken: {
        create: async ({
          data,
        }: {
          data: Omit<
            RefreshTokenRecord,
            "id" | "createdAt" | "updatedAt" | "revokedAt"
          > & { id?: string; revokedAt?: Date | null };
        }) => {
          const now = new Date();
          const record: RefreshTokenRecord = {
            id: data.id ?? randomUUID(),
            token: data.token,
            userId: data.userId,
            expiresAt: data.expiresAt,
            revokedAt: data.revokedAt ?? null,
            createdAt: now,
            updatedAt: now,
            userAgent: data.userAgent ?? null,
            ipAddress: data.ipAddress ?? null,
          };

          refreshTokens.set(record.id, record);
          return clone(record);
        },
        findUnique: async ({
          where,
          include,
        }: FindUniqueArgs<RefreshTokenRecord>) => {
          const token = where.id ? findRefreshTokenById(where.id) : undefined;
          return token ? attachUserToRefreshToken(token, include) : null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<RefreshTokenRecord>;
        }) => {
          const existing = findRefreshTokenById(where.id);

          if (!existing) {
            throw new Error("Refresh token not found");
          }

          const updated: RefreshTokenRecord = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };

          refreshTokens.set(existing.id, updated);
          return clone(updated);
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Partial<RefreshTokenRecord>;
          data: Partial<RefreshTokenRecord>;
        }) => {
          let count = 0;

          for (const token of refreshTokens.values()) {
            const matchId = where.id ? token.id === where.id : true;
            const matchToken = where.token ? token.token === where.token : true;
            const matchRevoked =
              "revokedAt" in where ? token.revokedAt === where.revokedAt : true;

            if (matchId && matchToken && matchRevoked) {
              const updated: RefreshTokenRecord = {
                ...token,
                ...data,
                updatedAt: new Date(),
              };

              refreshTokens.set(token.id, updated);
              count += 1;
            }
          }

          return { count };
        },
      },
      $transaction: async <T>(
        fn: (tx: ReturnType<typeof buildClient>) => Promise<T>
      ) => fn(buildClient()),
      $queryRaw: async () => [{ "?column?": 1 }],
      $reset: () => {
        users.clear();
        refreshTokens.clear();
        products.clear();
        inventory.clear();
        discountTypes.clear();
        orderDiscounts.clear();
        orders.clear();
        orderItems.clear();
      payments.clear();
      },
      $state: {
        users,
        refreshTokens,
        products,
        inventory,
        discountTypes,
        orderDiscounts,
        orders,
        orderItems,
      payments,
      },
    };

    return client;
  };

  return buildClient();
};

export type TestPrismaClient = ReturnType<typeof createTestPrisma>;
