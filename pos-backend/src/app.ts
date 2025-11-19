import cors from "cors";
import express from "express";

import authRouter from "./auth/authRoutes";
import { authenticateUser } from "./auth/authMiddleware";
import discountTypeRouter from "./discounts/discountTypeRoutes";
import inventoryRouter from "./inventory/inventoryRoutes";
import prisma from "./lib/prisma";
import { HttpError, isHttpError } from "./lib/httpError";
import { logger, serializeError } from "./lib/logger";
import orderRouter from "./orders/orderRoutes";
import productRouter from "./products/productRoutes";
import dashboardRouter from "./dashboard/dashboardRoutes";
import userRouter from "./users/userRoutes";
import sseRouter from "./notifications/sseRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/products", productRouter);
app.use("/inventory", inventoryRouter);
app.use("/discount-types", discountTypeRouter);
app.use("/orders", orderRouter);
app.use("/dashboard", dashboardRouter);
app.use("/users", userRouter);
app.use("/notifications", sseRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ status: "error", error: (error as Error).message });
  }
});

app.get("/protected-example", authenticateUser, (req, res) => {
  res.json({
    message: "You are authenticated.",
    userId: req.user!.id,
  });
});

// Centralized error handler to keep API responses consistent.
// Note: SSE connections handle their own errors, so we skip error handling for them
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Skip error handling for SSE connections (they handle errors themselves)
    if (req.path.startsWith("/notifications/stream")) {
      return;
    }

    if (isHttpError(error)) {
      logger.warn("Handled HttpError", { error: serializeError(error) });
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    logger.error("Unhandled application error", {
      error: serializeError(error),
    });
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
