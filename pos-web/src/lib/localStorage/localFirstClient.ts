/**
 * Local-first API client wrapper
 * Reads from IndexedDB first, syncs with server in background
 */

import { put, putMany, get, getAll, remove } from "./indexedDB";
import { addToSyncQueue } from "./syncQueue";
import { apiRequest } from "../apiClient";
import { isOnline } from "./syncManager";
import type { Product } from "../productClient";
import type {
  Order,
  OrderItem,
  OrderSummary,
  CheckoutConfig,
  FinalizeOrderPayload,
  FinalizeOrderResult,
  OrderStatus,
} from "../orderClient";
import type { InventoryItem } from "../inventoryClient";

// Product operations
export async function fetchProductsLocalFirst(): Promise<Product[]> {
  // Always try to get from local first
  const localProducts = await getAll<Product>("products");

  // If online, sync in background
  if (isOnline()) {
    try {
      const { fetchProducts } = await import("../productClient");
      const serverProducts = await fetchProducts();

      // Update local cache
      await putMany("products", serverProducts);

      return serverProducts;
    } catch (error) {
      console.warn(
        "Failed to sync products from server, using local cache",
        error
      );
      // Return local data if sync fails
      return localProducts;
    }
  }

  return localProducts;
}

// Order operations
export async function fetchOrdersLocalFirst(): Promise<Order[]> {
  const localOrders = await getAll<Order>("orders");

  if (isOnline()) {
    try {
      const { fetchOrders } = await import("../orderClient");
      const serverOrders = await fetchOrders();

      await putMany("orders", serverOrders);
      return serverOrders;
    } catch (error) {
      console.warn(
        "Failed to sync orders from server, using local cache",
        error
      );
      return localOrders;
    }
  }

  return localOrders;
}

export async function createOrderLocalFirst(payload: {
  cashierId: string;
  orderNumber?: string;
  status?: OrderStatus;
}): Promise<Order> {
  // Generate temporary ID for optimistic update
  const tempId = `temp-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const tempOrderNumber = payload.orderNumber || `ORD-${Date.now()}`;

  const optimisticOrder: Order = {
    id: tempId,
    orderNumber: tempOrderNumber,
    cashierId: payload.cashierId,
    status: (payload.status as Order["status"]) || "OPEN",
    subtotal: 0,
    discountTotal: 0,
    totalDue: 0,
    totalPaid: 0,
    changeDue: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    discounts: [],
    payments: [],
  };

  // Save optimistically to local
  await put("orders", optimisticOrder);

  // Queue for sync
  await addToSyncQueue({
    type: "CREATE_ORDER",
    endpoint: "/orders",
    method: "POST",
    payload,
  });

  // If online, try to sync immediately
  if (isOnline()) {
    try {
      const { createOrder } = await import("../orderClient");
      const serverOrder = await createOrder(payload);

      // Replace optimistic order with real one
      try {
        await remove("orders", tempId);
      } catch {
        // Ignore if temp order doesn't exist
      }
      await put("orders", serverOrder);

      return serverOrder;
    } catch (error) {
      console.warn("Failed to create order on server, will retry later", error);
      // Return optimistic order
      return optimisticOrder;
    }
  }

  return optimisticOrder;
}

export async function getOrderSummaryLocalFirst(
  orderId: string
): Promise<OrderSummary> {
  // Try to get from local first
  const order = await get<Order>("orders", orderId);

  if (order) {
    // Calculate summary locally
    const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
    const totals = {
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      totalDue: order.totalDue,
      totalPaid: order.totalPaid,
      changeDue: order.changeDue,
      balanceDue: order.totalDue - order.totalPaid,
    };

    return {
      order,
      totals,
      itemCount,
      paymentCount: order.payments.length,
    };
  }

  // If not in local and online, fetch from server
  if (isOnline()) {
    try {
      const { getOrderSummary } = await import("../orderClient");
      const summary = await getOrderSummary(orderId);

      // Update local cache
      await put("orders", summary.order);

      return summary;
    } catch (error) {
      throw new Error(
        "Order not found locally and unable to fetch from server"
      );
    }
  }

  throw new Error("Order not found and device is offline");
}

// Inventory operations
export async function fetchInventoryLocalFirst(): Promise<InventoryItem[]> {
  const localInventory = await getAll<InventoryItem & { productId?: string }>(
    "inventory"
  );

  if (isOnline()) {
    try {
      const { fetchInventory } = await import("../inventoryClient");
      const serverInventory = await fetchInventory();

      // Add productId field for IndexedDB keyPath (productId is the keyPath in the store)
      const inventoryWithProductId = serverInventory.map((item) => ({
        ...item,
        productId: item.product.id,
      }));

      await putMany("inventory", inventoryWithProductId);
      return serverInventory;
    } catch (error) {
      console.warn(
        "Failed to sync inventory from server, using local cache",
        error
      );
      return localInventory.map((item) => {
        // Remove productId from local items before returning (to match API response format)
        const { productId, ...rest } = item;
        return rest as InventoryItem;
      });
    }
  }

  return localInventory.map((item) => {
    // Remove productId from local items before returning (to match API response format)
    const { productId, ...rest } = item;
    return rest as InventoryItem;
  });
}

// Checkout config
export async function fetchCheckoutConfigLocalFirst(): Promise<CheckoutConfig> {
  const localConfig = await get<CheckoutConfig & { id: string }>(
    "checkoutConfig",
    "default"
  );

  if (isOnline()) {
    try {
      const { fetchCheckoutConfig } = await import("../orderClient");
      const serverConfig = await fetchCheckoutConfig();

      await put("checkoutConfig", { ...serverConfig, id: "default" });
      return serverConfig;
    } catch (error) {
      console.warn(
        "Failed to sync config from server, using local cache",
        error
      );
      if (localConfig) {
        const { id, ...config } = localConfig;
        return config;
      }
      throw error;
    }
  }

  if (localConfig) {
    const { id, ...config } = localConfig;
    return config;
  }

  throw new Error("Checkout config not available offline");
}

// Order item operations
export async function addOrderItemLocalFirst(
  orderId: string,
  payload: {
    productId?: string | null;
    nameSnapshot: string;
    notes?: string | null;
    qty: number;
    unitPrice: number;
    lineDiscountTotal?: number;
  }
): Promise<Order> {
  // Get current order
  const order = await get<Order>("orders", orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  // Calculate new item totals
  const lineSubtotal = payload.unitPrice * payload.qty;
  const lineDiscountTotal = payload.lineDiscountTotal || 0;
  const lineTotal = lineSubtotal - lineDiscountTotal;

  // Create optimistic item
  const tempItemId = `temp-item-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const newItem: OrderItem = {
    id: tempItemId,
    orderId,
    productId: payload.productId ?? null,
    nameSnapshot: payload.nameSnapshot,
    notes: payload.notes ?? null,
    qty: payload.qty,
    unitPrice: payload.unitPrice,
    lineSubtotal,
    lineDiscountTotal,
    lineTotal,
  };

  // Update order optimistically
  const updatedOrder: Order = {
    ...order,
    items: [...order.items, newItem],
    subtotal: order.subtotal + lineSubtotal,
    discountTotal: order.discountTotal + lineDiscountTotal,
    totalDue: order.totalDue + lineTotal,
  };

  await put("orders", updatedOrder);

  // Queue for sync
  await addToSyncQueue({
    type: "ADD_ORDER_ITEM",
    endpoint: `/orders/${orderId}/items`,
    method: "POST",
    payload,
  });

  // Try to sync immediately if online
  if (isOnline()) {
    try {
      const { addOrderItem } = await import("../orderClient");
      const serverOrder = await addOrderItem(orderId, payload);
      await put("orders", serverOrder);
      return serverOrder;
    } catch (error) {
      console.warn("Failed to add item on server, will retry later", error);
      return updatedOrder;
    }
  }

  return updatedOrder;
}

export async function updateOrderItemLocalFirst(
  orderId: string,
  itemId: string,
  payload: Partial<{
    productId: string | null;
    nameSnapshot: string;
    notes: string | null;
    qty: number;
    unitPrice: number;
    lineDiscountTotal: number;
  }>
): Promise<Order> {
  const order = await get<Order>("orders", orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error("Order item not found");
  }

  // Calculate updated values
  const updatedQty = payload.qty ?? item.qty;
  const updatedUnitPrice = payload.unitPrice ?? item.unitPrice;
  const updatedDiscount = payload.lineDiscountTotal ?? item.lineDiscountTotal;
  const lineSubtotal = updatedUnitPrice * updatedQty;
  const lineTotal = lineSubtotal - updatedDiscount;

  // Update item optimistically
  const updatedItem: OrderItem = {
    ...item,
    productId:
      payload.productId !== undefined ? payload.productId : item.productId,
    nameSnapshot: payload.nameSnapshot ?? item.nameSnapshot,
    notes: payload.notes !== undefined ? payload.notes : item.notes,
    qty: updatedQty,
    unitPrice: updatedUnitPrice,
    lineSubtotal,
    lineDiscountTotal: updatedDiscount,
    lineTotal,
  };

  // Recalculate order totals
  const otherItems = order.items.filter((i) => i.id !== itemId);
  const newSubtotal =
    otherItems.reduce((sum, i) => sum + i.lineSubtotal, 0) + lineSubtotal;
  const newDiscountTotal =
    otherItems.reduce((sum, i) => sum + i.lineDiscountTotal, 0) +
    updatedDiscount;
  const newTotalDue = newSubtotal - newDiscountTotal;

  const updatedOrder: Order = {
    ...order,
    items: [...otherItems, updatedItem],
    subtotal: newSubtotal,
    discountTotal: newDiscountTotal,
    totalDue: newTotalDue,
  };

  await put("orders", updatedOrder);

  // Queue for sync
  await addToSyncQueue({
    type: "UPDATE_ORDER_ITEM",
    endpoint: `/orders/${orderId}/items/${itemId}`,
    method: "PATCH",
    payload,
  });

  // Try to sync immediately if online
  if (isOnline()) {
    try {
      const { updateOrderItem } = await import("../orderClient");
      const serverOrder = await updateOrderItem(orderId, itemId, payload);
      await put("orders", serverOrder);
      return serverOrder;
    } catch (error) {
      console.warn("Failed to update item on server, will retry later", error);
      return updatedOrder;
    }
  }

  return updatedOrder;
}

export async function removeOrderItemLocalFirst(
  orderId: string,
  itemId: string
): Promise<Order> {
  const order = await get<Order>("orders", orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error("Order item not found");
  }

  // Update order optimistically
  const remainingItems = order.items.filter((i) => i.id !== itemId);
  const newSubtotal = remainingItems.reduce(
    (sum, i) => sum + i.lineSubtotal,
    0
  );
  const newDiscountTotal = remainingItems.reduce(
    (sum, i) => sum + i.lineDiscountTotal,
    0
  );
  const newTotalDue = newSubtotal - newDiscountTotal;

  const updatedOrder: Order = {
    ...order,
    items: remainingItems,
    subtotal: newSubtotal,
    discountTotal: newDiscountTotal,
    totalDue: newTotalDue,
  };

  await put("orders", updatedOrder);

  // Queue for sync
  await addToSyncQueue({
    type: "REMOVE_ORDER_ITEM",
    endpoint: `/orders/${orderId}/items/${itemId}`,
    method: "DELETE",
  });

  // Try to sync immediately if online
  if (isOnline()) {
    try {
      const { removeOrderItem } = await import("../orderClient");
      const serverOrder = await removeOrderItem(orderId, itemId);
      await put("orders", serverOrder);
      return serverOrder;
    } catch (error) {
      console.warn("Failed to remove item on server, will retry later", error);
      return updatedOrder;
    }
  }

  return updatedOrder;
}

export async function finalizeOrderLocalFirst(
  orderId: string,
  payload: FinalizeOrderPayload
): Promise<FinalizeOrderResult> {
  const order = await get<Order>("orders", orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  // Queue for sync
  await addToSyncQueue({
    type: "FINALIZE_ORDER",
    endpoint: `/orders/${orderId}/finalize`,
    method: "POST",
    payload,
  });

  // Try to sync immediately if online
  if (isOnline()) {
    try {
      const { finalizeOrder, getOrderReceipt } = await import("../orderClient");
      const result = await finalizeOrder(orderId, payload);

      // Update local cache
      await put("orders", result.order);

      return result;
    } catch (error) {
      console.warn(
        "Failed to finalize order on server, will retry later",
        error
      );
      throw error; // Don't allow finalizing offline (payment needs server confirmation)
    }
  }

  throw new Error(
    "Cannot finalize order while offline. Please connect to the internet."
  );
}

export async function voidOrderLocalFirst(orderId: string): Promise<Order> {
  const order = await get<Order>("orders", orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  // Update optimistically
  const updatedOrder: Order = {
    ...order,
    status: "VOID",
    totalPaid: 0,
    changeDue: 0,
    payments: [],
  };

  await put("orders", updatedOrder);

  // Queue for sync
  await addToSyncQueue({
    type: "VOID_ORDER",
    endpoint: `/orders/${orderId}/void`,
    method: "POST",
  });

  // Try to sync immediately if online
  if (isOnline()) {
    try {
      const { voidOrder } = await import("../orderClient");
      const serverOrder = await voidOrder(orderId);
      await put("orders", serverOrder);
      return serverOrder;
    } catch (error) {
      console.warn("Failed to void order on server, will retry later", error);
      return updatedOrder;
    }
  }

  return updatedOrder;
}
