import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from "./productService";
import { HttpError } from "../lib/httpError";
import { authenticateUser } from "../auth/authMiddleware";

const productRouter = Router();

productRouter.use(authenticateUser);

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireId = (req: Request): string => {
  const { id } = req.params;

  if (!id) {
    throw new HttpError(400, "Product id is required.");
  }

  return id;
};

productRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const products = await listProducts();
    res.json({ products });
  }),
);

productRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductById(requireId(req));
    res.json({ product });
  }),
);

productRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body);
    res.status(201).json({ product });
  }),
);

productRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await updateProduct(requireId(req), req.body);
    res.json({ product });
  }),
);

productRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteProduct(requireId(req));
    res.status(204).send();
  }),
);

export default productRouter;

