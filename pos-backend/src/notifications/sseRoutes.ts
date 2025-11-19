import type { Request, Response } from "express";
import { Router } from "express";
import { authenticateUser, optionalAuth } from "../auth/authMiddleware";
import { notificationManager } from "./notificationManager";
import { HttpError } from "../lib/httpError";
import { verifyAccessToken } from "../auth/jwt";
import { isAccessTokenRevoked } from "../auth/tokenBlacklist";

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
        throw new HttpError(401, "Invalid or expired access token", { cause: error });
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

    // Add CORS headers if needed
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

    // Add connection to notification manager
    notificationManager.addConnection(userId, res);

    // Handle client disconnect
    req.on("close", () => {
      // Connection cleanup is handled by notificationManager
      res.end();
    });
  }
);

export default sseRouter;

