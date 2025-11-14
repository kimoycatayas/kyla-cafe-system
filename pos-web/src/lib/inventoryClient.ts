import { apiRequest } from "./apiClient";
import { authStorage } from "./authStorage";

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = authStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export type InventoryItem = {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
  };
  quantity: number;
  lowStockThreshold: number;
  status: "ok" | "low";
  createdAt: string;
  updatedAt: string;
};

export type InventoryPayload = {
  productId: string;
  quantity: number;
  lowStockThreshold?: number;
};

export const fetchInventory = async (): Promise<InventoryItem[]> => {
  const response = await apiRequest<{ inventory: InventoryItem[] }>("/inventory", {
    headers: authHeaders(),
  });
  return response.inventory;
};

export const fetchStockTracker = async (): Promise<InventoryItem[]> => {
  const response = await apiRequest<{ inventory: InventoryItem[] }>(
    "/inventory/stock-tracker",
    {
      headers: authHeaders(),
    },
  );
  return response.inventory;
};

export const fetchLowStock = async (): Promise<InventoryItem[]> => {
  const response = await apiRequest<{ inventory: InventoryItem[] }>(
    "/inventory/low-stock",
    {
      headers: authHeaders(),
    },
  );
  return response.inventory;
};

export const createInventory = async (
  payload: InventoryPayload,
): Promise<InventoryItem> => {
  const response = await apiRequest<{ inventory: InventoryItem }>("/inventory", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return response.inventory;
};

export const updateInventory = async (
  id: string,
  payload: Partial<InventoryPayload>,
): Promise<InventoryItem> => {
  const response = await apiRequest<{ inventory: InventoryItem }>(`/inventory/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return response.inventory;
};

export const deleteInventory = async (id: string): Promise<void> => {
  await apiRequest(`/inventory/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    parseJson: false,
  });
};

