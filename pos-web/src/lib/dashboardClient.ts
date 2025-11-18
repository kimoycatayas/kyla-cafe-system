import { apiRequest } from "./apiClient";
import { authStorage } from "./authStorage";
import type { OrderStatus } from "./orderClient";

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = authStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

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

export const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const response = await apiRequest<{ metrics: DashboardMetrics }>(
    "/dashboard/metrics",
    {
      headers: authHeaders(),
    }
  );
  return response.metrics;
};






