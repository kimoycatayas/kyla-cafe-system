import { apiClient, ApiError } from "./api";
import type { OrderStatus } from "./orderClient";

/**
 * Dashboard client for fetching dashboard metrics
 */

export type DashboardMetrics = {
  salesSummary: {
    totalSalesToday: number;
    ordersToday: number;
    averageOrderValueToday: number;
    openOrders: number;
  };
  topProducts: Array<{
    productId: string | null;
    name: string;
    quantity: number;
    sales: number;
  }>;
  lowStockItems: Array<{
    productId: string;
    name: string;
    quantity: number;
    threshold: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    amount: number;
    createdAt: string;
    cashierName: string | null;
  }>;
};

/**
 * Fetch dashboard metrics
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const response = await apiClient.get<{ metrics: DashboardMetrics }>(
      "/dashboard/metrics"
    );
    return response.metrics;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch dashboard metrics. Please try again.",
      status: 0,
    } as ApiError;
  }
}

