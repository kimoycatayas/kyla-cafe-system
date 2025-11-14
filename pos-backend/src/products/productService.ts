import { Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { logger, serializeError } from "../lib/logger";

type NumericInput = number | string;

export type ProductInput = {
  name: string;
  sku: string;
  price: NumericInput;
  cost: NumericInput;
  barcode?: string | null;
};

export type ProductUpdateInput = Partial<ProductInput>;

export type ProductResponse = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  barcode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const sanitizeText = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${field} is required.`);
  }

  return trimmed;
};

const sanitizeOptionalText = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "Barcode must be a string.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeAmount = (value: NumericInput, field: string): Prisma.Decimal => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, `${field} must be a valid number.`);
  }

  if (numeric < 0) {
    throw new HttpError(400, `${field} cannot be negative.`);
  }

  return new Prisma.Decimal(numeric.toFixed(2));
};

const toNumber = (value: unknown): number => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value);
};

const mapProduct = (product: {
  id: string;
  name: string;
  sku: string;
  price: Prisma.Decimal | number | string;
  cost: Prisma.Decimal | number | string;
  barcode: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProductResponse => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  price: Number(toNumber(product.price).toFixed(2)),
  cost: Number(toNumber(product.cost).toFixed(2)),
  barcode: product.barcode,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const handlePrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = (error.meta?.target as string[]) ?? [];
      throw new HttpError(
        409,
        `A product with the same ${fields.join(", ")} already exists.`,
        { cause: error },
      );
    }
  }

  logger.error("Prisma operation failed", {
    error: serializeError(error),
  });
  throw error instanceof Error ? error : new Error("Unknown Prisma error");
};

export const createProduct = async (input: ProductInput): Promise<ProductResponse> => {
  const name = sanitizeText(input.name, "Product name");
  const sku = sanitizeText(input.sku, "SKU");
  const price = sanitizeAmount(input.price, "Price");
  const cost = sanitizeAmount(input.cost, "Cost");
  const barcode = sanitizeOptionalText(input.barcode ?? null);

  try {
    const product = await prisma.product.create({
      data: {
        name,
        sku,
        price,
        cost,
        barcode,
      },
    });

    return mapProduct(product);
  } catch (error) {
    throw handlePrismaError(error);
  }
};

export const listProducts = async (): Promise<ProductResponse[]> => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  return products.map(mapProduct);
};

export const getProductById = async (id: string): Promise<ProductResponse> => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new HttpError(404, "Product not found.");
  }

  return mapProduct(product);
};

export const updateProduct = async (
  id: string,
  input: ProductUpdateInput,
): Promise<ProductResponse> => {
  const data: Record<string, unknown> = {};

  if ("name" in input) {
    data.name = sanitizeText(input.name, "Product name");
  }

  if ("sku" in input) {
    data.sku = sanitizeText(input.sku as string, "SKU");
  }

  if ("price" in input && input.price !== undefined) {
    data.price = sanitizeAmount(input.price, "Price");
  }

  if ("cost" in input && input.cost !== undefined) {
    data.cost = sanitizeAmount(input.cost, "Cost");
  }

  if ("barcode" in input) {
    data.barcode = sanitizeOptionalText(input.barcode ?? null);
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "No product fields provided for update.");
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return mapProduct(product);
  } catch (error) {
    throw handlePrismaError(error);
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    await prisma.product.delete({ where: { id } });
  } catch (error) {
    throw new HttpError(404, "Product not found.", { cause: error });
  }
};

