import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import {
  createInventory,
  deleteInventory,
  getInventoryById,
  getLowStockAlerts,
  getStockTracker,
  listInventory,
  updateInventory,
} from "./inventoryService";
import { authenticateUser } from "../auth/authMiddleware";

const inventoryRouter = Router();

inventoryRouter.use(authenticateUser);

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
    throw new Error("Inventory id is required.");
  }
  return id;
};

inventoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const inventory = await listInventory();
    res.json({ inventory });
  }),
);

inventoryRouter.get(
  "/stock-tracker",
  asyncHandler(async (_req, res) => {
    const tracker = await getStockTracker();
    res.json({ inventory: tracker });
  }),
);

inventoryRouter.get(
  "/low-stock",
  asyncHandler(async (_req, res) => {
    const alerts = await getLowStockAlerts();
    res.json({ inventory: alerts });
  }),
);

inventoryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const inventory = await getInventoryById(requireId(req));
    res.json({ inventory });
  }),
);

inventoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const inventory = await createInventory(req.body);
    res.status(201).json({ inventory });
  }),
);

inventoryRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const inventory = await updateInventory(requireId(req), req.body);
    res.json({ inventory });
  }),
);

inventoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteInventory(requireId(req));
    res.status(204).send();
  }),
);

export default inventoryRouter;

