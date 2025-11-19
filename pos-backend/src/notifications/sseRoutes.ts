import type { Request, Response } from "express";
import { Router } from "express";
import { authenticateUser, optionalAuth } from "../auth/authMiddleware";
import { notificationManager } from "./notificationManager";
import { HttpError } from "../lib/httpError";
import { verifyAccessToken } from "../auth/jwt";
import { isAccessTokenRevoked } from "../auth/tokenBlacklist";
import { logger } from "../lib/logger";

const sseRouter = Router();

/**
 * SSE endpoint for real-time notifications
 * GET /notifications/stream?token=xxx
 *
 * Note: EventSource doesn't support custom headers, so we accept token via query param
 */
sseRouter.get(
  "/stream",
  optionalAuth, // Try to authenticate via header first
  async (req: Request, res: Response) => {
    // If not authenticated via header, try query parameter (for EventSource)
    let userId = req.user?.id;

    if (!userId) {
      const token = req.query.token as string | undefined;

      if (!token) {
        throw new HttpError(401, "Authorization token is required");
      }

      if (isAccessTokenRevoked(token)) {
        throw new HttpError(401, "Invalid or expired access token");
      }

      try {
        const payload = await verifyAccessToken(token);
        userId = payload.userId;
      } catch (error) {
        throw new HttpError(401, "Invalid or expired access token", {
          cause: error,
        });
      }
    }

    if (!userId) {
      throw new HttpError(401, "User authentication required");
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Add CORS headers for SSE
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Cache-Control, Authorization"
    );

    logger.info("SSE connection attempt", { userId, origin });

    // Prevent Express from closing the connection
    res.on("close", () => {
      logger.info("SSE response closed", { userId });
    });

    try {
      // Add connection to notification manager
      notificationManager.addConnection(userId, res);

      logger.info("SSE connection established", {
        userId,
        connectionCount: notificationManager.getConnectionCount(),
      });

      // Send initial connection confirmation immediately
      res.write(": SSE connection established\n\n");
    } catch (error) {
      logger.error("Failed to add SSE connection", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      if (!res.headersSent) {
        res.status(500).end();
      }
      return;
    }

    // Handle client disconnect
    req.on("close", () => {
      logger.info("SSE client disconnected (request closed)", { userId });
      // Connection cleanup is handled by notificationManager
      if (!res.closed) {
        res.end();
      }
    });

    // Handle request errors
    req.on("error", (error) => {
      logger.error("SSE request error", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      if (!res.closed) {
        res.end();
      }
    });

    // Handle response errors
    res.on("error", (error) => {
      logger.error("SSE response error", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    });
  }
);

/**
 * Test endpoint to manually trigger a notification
 * GET /notifications/test?userId=xxx (optional - broadcasts to all if not provided)
 */
sseRouter.get(
  "/test",
  authenticateUser,
  async (req: Request, res: Response) => {
    const targetUserId = req.query.userId as string | undefined;
    const testNotification = {
      orderId: "test-" + Date.now(),
      orderNumber: "TEST-ORDER",
      totalDue: 100.0,
      cashierId: req.user?.id || "test-cashier",
      status: "PAID",
      createdAt: new Date().toISOString(),
      itemCount: 1,
    };

    if (targetUserId) {
      notificationManager.notifyUser(
        targetUserId,
        "new_order",
        testNotification
      );
      logger.info("Test notification sent to user", { targetUserId });
      res.json({
        message: "Test notification sent to user",
        userId: targetUserId,
        notification: testNotification,
      });
    } else {
      notificationManager.broadcast("new_order", testNotification);
      logger.info("Test notification broadcasted to all", {
        connectionCount: notificationManager.getConnectionCount(),
      });
      res.json({
        message: "Test notification broadcasted to all connected users",
        connectionCount: notificationManager.getConnectionCount(),
        notification: testNotification,
      });
    }
  }
);

/**
 * Get connection status
 * GET /notifications/status
 */
sseRouter.get("/status", authenticateUser, (req: Request, res: Response) => {
  const userId = req.user?.id;
  const userConnections = userId
    ? notificationManager.getUserConnections(userId)
    : 0;

  res.json({
    totalConnections: notificationManager.getConnectionCount(),
    userConnections,
    userId,
  });
});

export default sseRouter;
