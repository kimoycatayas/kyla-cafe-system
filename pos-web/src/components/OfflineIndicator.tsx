"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setShowBanner(!online);
    };

    // Set initial state
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200">
          <svg
            className="h-3 w-3 text-amber-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Working Offline
          </p>
          <p className="text-xs text-amber-700">
            Changes will sync when connection is restored
          </p>
        </div>
        <button
          onClick={() => setShowBanner(false)}
          className="ml-2 text-amber-700 hover:text-amber-900"
          aria-label="Dismiss"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
