"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";
import { initializeInstallPrompt } from "@/lib/pwa/installPrompt";
import { startSyncManager, stopSyncManager } from "@/lib/localStorage/syncManager";

export function PWAInitializer() {
  useEffect(() => {
    // Register service worker
    void registerServiceWorker();

    // Initialize install prompt handler
    initializeInstallPrompt();

    // Start sync manager
    startSyncManager(10000); // Check every 10 seconds

    return () => {
      // Cleanup if needed
      stopSyncManager();
    };
  }, []);

  return null;
}

