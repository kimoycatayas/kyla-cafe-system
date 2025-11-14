import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { logger } from "../lib/logger";

type NumericInput = number | string;

export type InventoryInput = {
  productId: string;
  quantity: NumericInput;
  lowStockThreshold?: NumericInput;
};

export type InventoryUpdateInput = Partial<InventoryInput>;

export type InventoryResponse = {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
  };
  quantity: number;
  lowStockThreshold: number;
  status: "ok" | "low";
  createdAt: Date;
  updatedAt: Date;
};

const sanitizeQuantity = (value: NumericInput, field: string): number => {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new HttpError(400, `${field} must be a valid number.`);
  }

  if (!Number.isInteger(numericValue)) {
    throw new HttpError(400, `${field} must be an integer value.`);
  }

  if (numericValue < 0) {
    throw new HttpError(400, `${field} cannot be negative.`);
  }

  return numericValue;
};

const ensureProductExists = async (productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    throw new HttpError(404, "Product not found.");
  }

  return product;
};

const computeStatus = (quantity: number, threshold: number): "ok" | "low" =>
  quantity <= threshold ? "low" : "ok";

const mapInventory = (
  inventory: {
    id: string;
    quantity: number;
    lowStockThreshold: number;
    createdAt: Date;
    updatedAt: Date;
  } & {
    product: {
      id: string;
      name: string;
      sku: string;
      barcode: string | null;
    };
  },
): InventoryResponse => ({
  id: inventory.id,
  product: {
    id: inventory.product.id,
    name: inventory.product.name,
    sku: inventory.product.sku,
    barcode: inventory.product.barcode ?? null,
  },
  quantity: inventory.quantity,
  lowStockThreshold: inventory.lowStockThreshold,
  status: computeStatus(inventory.quantity, inventory.lowStockThreshold),
  createdAt: inventory.createdAt,
  updatedAt: inventory.updatedAt,
});

export const createInventory = async (
  input: InventoryInput,
): Promise<InventoryResponse> => {
  if (!input.productId?.trim()) {
    throw new HttpError(400, "Product id is required.");
  }

  const product = await ensureProductExists(input.productId);
  const quantity = sanitizeQuantity(input.quantity, "Quantity");
  const lowStockThreshold = sanitizeQuantity(
    input.lowStockThreshold ?? 5,
    "Low stock threshold",
  );

  try {
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity,
        lowStockThreshold,
      },
      include: {
        product: true,
      },
    });

    return mapInventory(inventory);
  } catch (error) {
    logger.error("Failed to create inventory", { error });
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new HttpError(409, "Inventory already exists for this product.", {
        cause: error,
      });
    }
    throw error;
  }
};

export const listInventory = async (): Promise<InventoryResponse[]> => {
  const inventory = await prisma.inventory.findMany({
    include: { product: true },
    orderBy: { updatedAt: "desc" },
  });

  return inventory.map(mapInventory);
};

export const getInventoryById = async (id: string): Promise<InventoryResponse> => {
  if (!id) {
    throw new HttpError(400, "Inventory id is required.");
  }

  const inventory = await prisma.inventory.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!inventory) {
    throw new HttpError(404, "Inventory record not found.");
  }

  return mapInventory(inventory);
};

export const updateInventory = async (
  id: string,
  input: InventoryUpdateInput,
): Promise<InventoryResponse> => {
  if (!id) {
    throw new HttpError(400, "Inventory id is required.");
  }

  const data: Record<string, unknown> = {};

  if (input.productId) {
    const product = await ensureProductExists(input.productId);
    data.productId = product.id;
  }

  if (input.quantity !== undefined) {
    data.quantity = sanitizeQuantity(input.quantity, "Quantity");
  }

  if (input.lowStockThreshold !== undefined) {
    data.lowStockThreshold = sanitizeQuantity(
      input.lowStockThreshold,
      "Low stock threshold",
    );
  }

  try {
    const inventory = await prisma.inventory.update({
      where: { id },
      data,
      include: { product: true },
    });

    return mapInventory(inventory);
  } catch (error) {
    logger.error("Failed to update inventory", { error });
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new HttpError(409, "Inventory already exists for this product.", {
        cause: error,
      });
    }

    throw error;
  }
};

export const deleteInventory = async (id: string): Promise<void> => {
  try {
    await prisma.inventory.delete({ where: { id } });
  } catch (error) {
    throw new HttpError(404, "Inventory record not found.", { cause: error });
  }
};

export const getStockTracker = async (): Promise<InventoryResponse[]> => {
  const inventory = await prisma.inventory.findMany({
    include: { product: true },
    orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }],
  });

  return inventory.map(mapInventory);
};

export const getLowStockAlerts = async (): Promise<InventoryResponse[]> => {
  const inventory = await prisma.inventory.findMany({
    include: { product: true },
    orderBy: [{ quantity: "asc" }],
  });

  return inventory
    .map(mapInventory)
    .filter((item) => item.status === "low");
};

