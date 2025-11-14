import "../test/setupEnv";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestPrisma } from "../test/createTestPrisma";

const testPrisma = createTestPrisma();

vi.mock("../lib/prisma", () => ({
  __esModule: true,
  default: testPrisma,
}));

let createDiscountType: typeof import("./discountTypeService").createDiscountType;
let deleteDiscountType: typeof import("./discountTypeService").deleteDiscountType;
let getDiscountTypeById: typeof import("./discountTypeService").getDiscountTypeById;
let listDiscountTypes: typeof import("./discountTypeService").listDiscountTypes;
let updateDiscountType: typeof import("./discountTypeService").updateDiscountType;

beforeAll(async () => {
  ({
    createDiscountType,
    deleteDiscountType,
    getDiscountTypeById,
    listDiscountTypes,
    updateDiscountType,
  } = await import("./discountTypeService"));
});

describe("discountTypeService", () => {
  beforeEach(() => {
    testPrisma.$reset();
  });

  it("creates and lists discount types", async () => {
    await createDiscountType({
      name: "Senior Citizen",
      type: "PERCENT",
      value: 20,
      scope: "ORDER",
      requiresManagerPin: true,
    });

    const result = await listDiscountTypes();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Senior Citizen");
    expect(result[0]?.value).toBe(20);
  });

  it("updates an existing discount type", async () => {
    const discountType = await createDiscountType({
      name: "Promo 10",
      type: "PERCENT",
      value: 10,
      scope: "ORDER",
    });

    const updated = await updateDiscountType(discountType.id, {
      value: 12.5,
      requiresManagerPin: true,
    });

    expect(updated.value).toBeCloseTo(12.5);
    expect(updated.requiresManagerPin).toBe(true);
  });

  it("retrieves and deletes a discount type", async () => {
    const discountType = await createDiscountType({
      name: "Fixed 50 Off",
      type: "FIXED",
      value: 50,
      scope: "ORDER",
    });

    const fetched = await getDiscountTypeById(discountType.id);
    expect(fetched.name).toBe("Fixed 50 Off");

    await deleteDiscountType(discountType.id);

    await expect(getDiscountTypeById(discountType.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

