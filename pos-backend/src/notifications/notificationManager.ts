import type { Response } from "express";
import { logger } from "../lib/logger";

type SSEConnection = {
  userId: string;
  response: Response;
  connectedAt: Date;
};

class NotificationManager {
  private connections: Map<string, SSEConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Add a new SSE connection
   */
  addConnection(userId: string, response: Response): void {
    const connectionId = `${userId}-${Date.now()}-${Math.random()}`;
    
    this.connections.set(connectionId, {
      userId,
      response,
      connectedAt: new Date(),
    });

    logger.info("SSE connection added", { userId, connectionId });

    // Handle client disconnect
    response.on("close", () => {
      this.removeConnection(connectionId);
    });

    // Send initial connection message
    this.sendToConnection(connectionId, {
      type: "connected",
      message: "Connected to notification stream",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      logger.info("SSE connection removed", {
        userId: connection.userId,
        connectionId,
      });
    }
  }

  /**
   * Send notification to a specific user
   */
  notifyUser(userId: string, event: string, data: unknown): void {
    let notifiedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.userId === userId) {
        try {
          this.sendToConnection(connectionId, {
            type: event,
            data,
            timestamp: new Date().toISOString(),
          });
          notifiedCount++;
        } catch (error) {
          logger.warn("Failed to send notification to connection", {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Remove dead connection
          this.removeConnection(connectionId);
        }
      }
    }

    logger.info("Notification sent to user", {
      userId,
      event,
      notifiedCount,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcast(event: string, data: unknown): void {
    let notifiedCount = 0;
    const deadConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        this.sendToConnection(connectionId, {
          type: event,
          data,
          timestamp: new Date().toISOString(),
        });
        notifiedCount++;
      } catch (error) {
        logger.warn("Failed to send broadcast to connection", {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
        deadConnections.push(connectionId);
      }
    }

    // Clean up dead connections
    deadConnections.forEach((id) => this.removeConnection(id));

    logger.info("Broadcast notification sent", {
      event,
      notifiedCount,
      totalConnections: this.connections.size,
    });
  }

  /**
   * Broadcast to users with specific roles
   */
  broadcastToRoles(roles: string[], event: string, data: unknown): void {
    // Note: This requires user role information
    // For now, we'll broadcast to all and let the frontend filter
    // In a production system, you'd want to store role info with connections
    this.broadcast(event, data);
  }

  /**
   * Send data to a specific connection
   */
  private sendToConnection(
    connectionId: string,
    payload: { type: string; data?: unknown; message?: string; timestamp: string }
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const { response } = connection;
    
    // Format as SSE event
    const eventData = JSON.stringify(payload);
    response.write(`event: ${payload.type}\n`);
    response.write(`data: ${eventData}\n\n`);
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const deadConnections: string[] = [];

      for (const [connectionId, connection] of this.connections.entries()) {
        try {
          // Send heartbeat comment (SSE format)
          connection.response.write(": heartbeat\n\n");
        } catch (error) {
          logger.warn("Heartbeat failed for connection", {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
          deadConnections.push(connectionId);
        }
      }

      // Clean up dead connections
      deadConnections.forEach((id) => this.removeConnection(id));
    }, 30000); // Every 30 seconds
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for a specific user
   */
  getUserConnections(userId: string): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        connection.response.end();
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.connections.clear();
    logger.info("Notification manager cleaned up");
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();

