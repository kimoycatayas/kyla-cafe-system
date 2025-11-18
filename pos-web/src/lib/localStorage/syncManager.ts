/**
 * Sync Manager - handles syncing queued operations when online
 */

import {
  getPendingSyncItems,
  markSyncItemAsSyncing,
  markSyncItemAsCompleted,
  markSyncItemAsFailed,
  shouldRetry,
  type SyncQueueItem,
} from "./syncQueue";
import { apiRequest } from "../apiClient";

let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export async function processSyncQueue(): Promise<void> {
  if (isSyncing || !isOnline()) {
    return;
  }

  isSyncing = true;

  try {
    const pendingItems = await getPendingSyncItems();
    const itemsToSync = pendingItems.filter(shouldRetry);

    for (const item of itemsToSync) {
      if (!item.id) continue;

      try {
        await markSyncItemAsSyncing(item.id);

        const response = await apiRequest(item.endpoint, {
          method: item.method,
          body: item.payload ? JSON.stringify(item.payload) : undefined,
          headers: item.headers,
        });

        // Update local data if needed
        // This will be handled by the local-first API client

        await markSyncItemAsCompleted(item.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await markSyncItemAsFailed(item.id, errorMessage);
      }
    }
  } finally {
    isSyncing = false;
  }
}

export function startSyncManager(intervalMs: number = 10000): void {
  if (syncInterval) {
    stopSyncManager();
  }

  // Process immediately if online
  if (isOnline()) {
    void processSyncQueue();
  }

  // Then process periodically
  syncInterval = setInterval(() => {
    if (isOnline()) {
      void processSyncQueue();
    }
  }, intervalMs);

  // Also listen for online events
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      void processSyncQueue();
    });
  }
}

export function stopSyncManager(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
