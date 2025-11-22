import { apiClient, ApiError } from "./api";

/**
 * Inventory client for fetching and managing inventory
 */

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

/**
 * Fetch all inventory items
 */
export async function fetchInventory(): Promise<InventoryItem[]> {
  try {
    const response = await apiClient.get<{ inventory: InventoryItem[] }>(
      "/inventory"
    );
    return response.inventory;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch inventory. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Fetch low stock alerts
 */
export async function fetchLowStock(): Promise<InventoryItem[]> {
  try {
    const response = await apiClient.get<{ inventory: InventoryItem[] }>(
      "/inventory/low-stock"
    );
    return response.inventory;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch low stock alerts. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Get inventory by ID
 */
export async function getInventoryById(id: string): Promise<InventoryItem> {
  try {
    const response = await apiClient.get<{ inventory: InventoryItem }>(
      `/inventory/${id}`
    );
    return response.inventory;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch inventory item. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Create a new inventory item
 */
export interface CreateInventoryInput {
  productId: string;
  quantity: number | string;
  lowStockThreshold?: number | string;
}

export async function createInventory(
  input: CreateInventoryInput
): Promise<InventoryItem> {
  try {
    const payload = {
      productId: input.productId,
      quantity: typeof input.quantity === "string" ? parseInt(input.quantity, 10) : input.quantity,
      lowStockThreshold:
        input.lowStockThreshold !== undefined
          ? typeof input.lowStockThreshold === "string"
            ? parseInt(input.lowStockThreshold, 10)
            : input.lowStockThreshold
          : undefined,
    };
    const response = await apiClient.post<{ inventory: InventoryItem }>(
      "/inventory",
      payload
    );
    return response.inventory;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to create inventory item. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Update an existing inventory item
 */
export interface UpdateInventoryInput {
  quantity?: number | string;
  lowStockThreshold?: number | string;
}

export async function updateInventory(
  id: string,
  input: UpdateInventoryInput
): Promise<InventoryItem> {
  try {
    const payload: Record<string, number> = {};
    if (input.quantity !== undefined) {
      payload.quantity =
        typeof input.quantity === "string"
          ? parseInt(input.quantity, 10)
          : input.quantity;
    }
    if (input.lowStockThreshold !== undefined) {
      payload.lowStockThreshold =
        typeof input.lowStockThreshold === "string"
          ? parseInt(input.lowStockThreshold, 10)
          : input.lowStockThreshold;
    }
    const response = await apiClient.patch<{ inventory: InventoryItem }>(
      `/inventory/${id}`,
      payload
    );
    return response.inventory;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to update inventory item. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Delete an inventory item
 */
export async function deleteInventory(id: string): Promise<void> {
  try {
    await apiClient.delete(`/inventory/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to delete inventory item. Please try again.",
      status: 0,
    } as ApiError;
  }
}
