import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import {
  addOrderItem,
  applyOrderDiscount,
  createOrder,
  createAndFinalizeOrder,
  deleteOrder,
  finalizeOrder,
  getCheckoutConfig,
  getOrderById,
  getOrderReceipt,
  getOrderSummary,
  listOrders,
  refundOrder,
  removeOrderDiscount,
  removeOrderItem,
  updateOrder,
  updateOrderDiscount,
  updateOrderItem,
  voidOrder,
} from "./orderService";
import { authenticateUser } from "../auth/authMiddleware";

const orderRouter = Router();

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireOrderId = (req: Request): string => {
  const { orderId } = req.params;
  if (!orderId) {
    throw new Error("Order id is required.");
  }
  return orderId;
};

const requireItemId = (req: Request): string => {
  const { itemId } = req.params;
  if (!itemId) {
    throw new Error("Order item id is required.");
  }
  return itemId;
};

const requireDiscountId = (req: Request): string => {
  const { discountId } = req.params;
  if (!discountId) {
    throw new Error("Order discount id is required.");
  }
  return discountId;
};

orderRouter.use(authenticateUser);

orderRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config = await getCheckoutConfig();
    res.json({ config });
  })
);

orderRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const orders = await listOrders();
    res.json({ orders });
  })
);

orderRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const order = await createOrder(req.body);
    res.status(201).json({ order });
  })
);

orderRouter.post(
  "/create-and-finalize",
  asyncHandler(async (req, res) => {
    const result = await createAndFinalizeOrder(req.body);
    res.status(201).json(result);
  })
);

orderRouter.get(
  "/:orderId/summary",
  asyncHandler(async (req, res) => {
    const summary = await getOrderSummary(requireOrderId(req));
    res.json({ summary });
  })
);

orderRouter.get(
  "/:orderId/receipt",
  asyncHandler(async (req, res) => {
    const receipt = await getOrderReceipt(requireOrderId(req));
    res.json({ receipt });
  })
);

orderRouter.get(
  "/:orderId/receipt/download",
  asyncHandler(async (req, res) => {
    const receipt = await getOrderReceipt(requireOrderId(req));
    res.setHeader("Content-Type", receipt.printable.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receipt.printable.filename}"`
    );
    res.send(receipt.printable.content);
  })
);

orderRouter.get(
  "/:orderId",
  asyncHandler(async (req, res) => {
    const order = await getOrderById(requireOrderId(req));
    res.json({ order });
  })
);

orderRouter.patch(
  "/:orderId",
  asyncHandler(async (req, res) => {
    const order = await updateOrder(requireOrderId(req), req.body);
    res.json({ order });
  })
);

orderRouter.delete(
  "/:orderId",
  asyncHandler(async (req, res) => {
    await deleteOrder(requireOrderId(req));
    res.status(204).send();
  })
);

orderRouter.post(
  "/:orderId/finalize",
  asyncHandler(async (req, res) => {
    const order = await finalizeOrder(requireOrderId(req), req.body);
    const receipt = await getOrderReceipt(order.id);
    res.json({ order, receipt });
  })
);

orderRouter.post(
  "/:orderId/void",
  asyncHandler(async (req, res) => {
    const order = await voidOrder(requireOrderId(req));
    res.json({ order });
  })
);

orderRouter.post(
  "/:orderId/refund",
  asyncHandler(async (req, res) => {
    const order = await refundOrder(requireOrderId(req), req.body);
    res.json({ order });
  })
);

orderRouter.post(
  "/:orderId/items",
  asyncHandler(async (req, res) => {
    const order = await addOrderItem(requireOrderId(req), req.body);
    res.status(201).json({ order });
  })
);

orderRouter.patch(
  "/:orderId/items/:itemId",
  asyncHandler(async (req, res) => {
    const order = await updateOrderItem(
      requireOrderId(req),
      requireItemId(req),
      req.body
    );
    res.json({ order });
  })
);

orderRouter.delete(
  "/:orderId/items/:itemId",
  asyncHandler(async (req, res) => {
    const order = await removeOrderItem(
      requireOrderId(req),
      requireItemId(req)
    );
    res.json({ order });
  })
);

orderRouter.post(
  "/:orderId/discounts",
  asyncHandler(async (req, res) => {
    const order = await applyOrderDiscount(requireOrderId(req), req.body);
    res.status(201).json({ order });
  })
);

orderRouter.patch(
  "/:orderId/discounts/:discountId",
  asyncHandler(async (req, res) => {
    const order = await updateOrderDiscount(
      requireOrderId(req),
      requireDiscountId(req),
      req.body
    );
    res.json({ order });
  })
);

orderRouter.delete(
  "/:orderId/discounts/:discountId",
  asyncHandler(async (req, res) => {
    const order = await removeOrderDiscount(
      requireOrderId(req),
      requireDiscountId(req)
    );
    res.json({ order });
  })
);

export default orderRouter;
