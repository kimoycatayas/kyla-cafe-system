import { notificationManager } from "./notificationManager";
import type { OrderResponse } from "../orders/orderService";
import { logger } from "../lib/logger";

export type NewOrderNotification = {
  orderId: string;
  orderNumber: string;
  totalDue: number;
  cashierId: string;
  status: string;
  createdAt: string;
  itemCount: number;
};

/**
 * Notify all connected users about a new order
 */
export const notifyNewOrder = (order: OrderResponse): void => {
  try {
    const notification: NewOrderNotification = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalDue: order.totalDue,
      cashierId: order.cashierId,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    };

    // Broadcast to all connected users
    notificationManager.broadcast("new_order", notification);

    logger.info("New order notification sent", {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    logger.error("Failed to send new order notification", {
      error: error instanceof Error ? error.message : String(error),
      orderId: order.id,
    });
  }
};

/**
 * Notify a specific user about a new order
 */
export const notifyUserNewOrder = (
  userId: string,
  order: OrderResponse
): void => {
  try {
    const notification: NewOrderNotification = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalDue: order.totalDue,
      cashierId: order.cashierId,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    };

    notificationManager.notifyUser(userId, "new_order", notification);

    logger.info("New order notification sent to user", {
      userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    logger.error("Failed to send new order notification to user", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      orderId: order.id,
    });
  }
};

