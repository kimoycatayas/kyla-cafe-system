/**
 * Sync queue for managing offline operations
 * Queues operations when offline, syncs when online
 */

import { put, getAll, remove, get, StoreName } from "./indexedDB";

export type SyncOperationType =
  | "CREATE_ORDER"
  | "ADD_ORDER_ITEM"
  | "UPDATE_ORDER_ITEM"
  | "REMOVE_ORDER_ITEM"
  | "FINALIZE_ORDER"
  | "VOID_ORDER"
  | "UPDATE_INVENTORY"
  | "CREATE_PRODUCT"
  | "UPDATE_PRODUCT"
  | "DELETE_PRODUCT";

export type SyncStatus = "PENDING" | "SYNCING" | "COMPLETED" | "FAILED";

export interface SyncQueueItem {
  id?: number;
  type: SyncOperationType;
  status: SyncStatus;
  endpoint: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  payload?: unknown;
  headers?: Record<string, string>;
  retryCount: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export async function addToSyncQueue(
  operation: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt">
): Promise<number> {
  const db = await import("./indexedDB").then((m) => m.openDB());
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["syncQueue"], "readwrite");
    const store = transaction.objectStore("syncQueue");
    
    const item: Omit<SyncQueueItem, "id"> = {
      ...operation,
      status: "PENDING",
      retryCount: 0,
      createdAt: Date.now(),
    };
    
    const request = store.add(item);
    
    request.onsuccess = () => {
      resolve(request.result as number);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const all = await getAll<SyncQueueItem & { id: string }>("syncQueue");
  return all.map((item) => {
    const { id, ...rest } = item;
    return { ...rest, id: id ? Number(id) : undefined };
  }).filter((item) => item.status === "PENDING" || item.status === "FAILED");
}

export async function markSyncItemAsSyncing(id: number): Promise<void> {
  const item = await get<SyncQueueItem & { id: string }>("syncQueue", id.toString());
  if (item) {
    await put<SyncQueueItem & { id: string }>("syncQueue", {
      ...item,
      id: id.toString(),
      status: "SYNCING",
      lastAttempt: Date.now(),
    } as SyncQueueItem & { id: string });
  }
}

export async function markSyncItemAsCompleted(id: number): Promise<void> {
  await remove("syncQueue", id.toString());
}

export async function markSyncItemAsFailed(
  id: number,
  error: string
): Promise<void> {
  const item = await get<SyncQueueItem & { id: string }>("syncQueue", id.toString());
  if (item) {
    const newRetryCount = item.retryCount + 1;
    await put<SyncQueueItem & { id: string }>("syncQueue", {
      ...item,
      id: id.toString(),
      status: newRetryCount >= MAX_RETRIES ? "FAILED" : "PENDING",
      retryCount: newRetryCount,
      lastAttempt: Date.now(),
      error,
    } as SyncQueueItem & { id: string });
  }
}

export async function clearCompletedSyncItems(): Promise<void> {
  const all = await getAll<SyncQueueItem & { id: string }>("syncQueue");
  const completed = all.filter((item) => {
    const { id, ...rest } = item;
    const syncItem: SyncQueueItem = { ...rest, id: id ? Number(id) : undefined };
    return syncItem.status === "COMPLETED";
  });
  
  for (const item of completed) {
    if (item.id) {
      await remove("syncQueue", item.id);
    }
  }
}

// Helper to check if we should retry based on delay
export function shouldRetry(item: SyncQueueItem): boolean {
  if (item.status === "COMPLETED") return false;
  if (item.retryCount >= MAX_RETRIES) return false;
  
  if (!item.lastAttempt) return true;
  
  const timeSinceLastAttempt = Date.now() - item.lastAttempt;
  return timeSinceLastAttempt >= RETRY_DELAY;
}

