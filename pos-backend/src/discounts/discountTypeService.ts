import {
  Prisma,
  DiscountScope,
  DiscountTypeKind,
} from "../generated/prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";

export type DiscountTypeInput = {
  name: string;
  type: DiscountTypeKind;
  value: number | string;
  scope: DiscountScope;
  requiresManagerPin?: boolean;
};

export type DiscountTypeUpdateInput = Partial<DiscountTypeInput>;

export type DiscountTypeResponse = {
  id: string;
  name: string;
  type: DiscountTypeKind;
  value: number;
  scope: DiscountScope;
  requiresManagerPin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const sanitizeValue = (value: number | string): Prisma.Decimal => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new HttpError(400, "Discount value must be a positive number.");
  }

  return new Prisma.Decimal(numeric.toFixed(2));
};

const toNumber = (value: Prisma.Decimal | number | string): number => {
  if (value instanceof Prisma.Decimal) {
    return Number(value.toFixed(2));
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, "Discount value must be numeric.");
  }

  return Number(numeric.toFixed(2));
};

const mapDiscountType = (
  discountType: Prisma.DiscountTypeGetPayload<Record<string, never>>,
): DiscountTypeResponse => ({
  id: discountType.id,
  name: discountType.name,
  type: discountType.type,
  value: toNumber(discountType.value),
  scope: discountType.scope,
  requiresManagerPin: discountType.requiresManagerPin,
  createdAt: discountType.createdAt,
  updatedAt: discountType.updatedAt,
});

export const listDiscountTypes = async (): Promise<DiscountTypeResponse[]> => {
  const discountTypes = await prisma.discountType.findMany({
    orderBy: { createdAt: "desc" },
  });

  return discountTypes.map(mapDiscountType);
};

export const createDiscountType = async (
  input: DiscountTypeInput,
): Promise<DiscountTypeResponse> => {
  if (!input.name?.trim()) {
    throw new HttpError(400, "Discount name is required.");
  }

  const discountType = await prisma.discountType.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      value: sanitizeValue(input.value),
      scope: input.scope,
      requiresManagerPin: Boolean(input.requiresManagerPin),
    },
  });

  return mapDiscountType(discountType);
};

export const getDiscountTypeById = async (
  id: string,
): Promise<DiscountTypeResponse> => {
  const discountType = await prisma.discountType.findUnique({
    where: { id },
  });

  if (!discountType) {
    throw new HttpError(404, "Discount type not found.");
  }

  return mapDiscountType(discountType);
};

export const updateDiscountType = async (
  id: string,
  input: DiscountTypeUpdateInput,
): Promise<DiscountTypeResponse> => {
  const data: Prisma.DiscountTypeUpdateInput = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new HttpError(400, "Discount name cannot be empty.");
    }
    data.name = trimmed;
  }

  if (input.type !== undefined) {
    data.type = input.type;
  }

  if (input.scope !== undefined) {
    data.scope = input.scope;
  }

  if (input.value !== undefined) {
    data.value = sanitizeValue(input.value);
  }

  if (input.requiresManagerPin !== undefined) {
    data.requiresManagerPin = input.requiresManagerPin;
  }

  const discountType = await prisma.discountType.update({
    where: { id },
    data,
  });

  return mapDiscountType(discountType);
};

export const deleteDiscountType = async (id: string): Promise<void> => {
  const usageCount = await prisma.orderDiscount.count({
    where: { discountTypeId: id },
  });

  if (usageCount > 0) {
    throw new HttpError(
      400,
      "Unable to delete discount type because it is used by existing orders.",
    );
  }

  await prisma.discountType.delete({
    where: { id },
  });
};

