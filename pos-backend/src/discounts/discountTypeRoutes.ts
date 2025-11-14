import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import {
  createDiscountType,
  deleteDiscountType,
  getDiscountTypeById,
  listDiscountTypes,
  updateDiscountType,
} from "./discountTypeService";
import { authenticateUser } from "../auth/authMiddleware";

const discountTypeRouter = Router();

discountTypeRouter.use(authenticateUser);

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireId = (req: Request): string => {
  const { id } = req.params;
  if (!id) {
    throw new Error("Discount type id is required.");
  }
  return id;
};

discountTypeRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const discountTypes = await listDiscountTypes();
    res.json({ discountTypes });
  })
);

discountTypeRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const discountType = await getDiscountTypeById(requireId(req));
    res.json({ discountType });
  })
);

discountTypeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const discountType = await createDiscountType(req.body);
    res.status(201).json({ discountType });
  })
);

discountTypeRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const discountType = await updateDiscountType(requireId(req), req.body);
    res.json({ discountType });
  })
);

discountTypeRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteDiscountType(requireId(req));
    res.status(204).send();
  })
);

export default discountTypeRouter;
