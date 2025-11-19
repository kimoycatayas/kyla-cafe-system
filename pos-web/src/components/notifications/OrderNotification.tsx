"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/notifications/notificationContext";

export function OrderNotification() {
  const { notifications, unreadCount, markAsRead, isConnected } =
    useNotifications();
  const [visibleNotifications, setVisibleNotifications] = useState<
    typeof notifications
  >([]);

  useEffect(() => {
    // Show only unread notifications
    const unread = notifications.filter((n) => !n.read);
    setVisibleNotifications(unread.slice(0, 3)); // Show max 3 at a time
  }, [notifications]);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleNotifications.map((notification) => {
        if (notification.type !== "new_order") {
          return null;
        }

        const { orderNumber, totalDue, itemCount } = notification.data;

        return (
          <div
            key={notification.id}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4 animate-in slide-in-from-right-5 duration-300"
            onClick={() => markAsRead(notification.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    New Order
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Order <span className="font-mono font-semibold">{orderNumber}</span>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {itemCount} item{itemCount !== 1 ? "s" : ""} • ₱
                  {totalDue.toFixed(2)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Dismiss notification"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
      })}
      
      {/* Connection status indicator (optional, for debugging) */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-slate-500 mt-2">
          {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        </div>
      )}
    </div>
  );
}

