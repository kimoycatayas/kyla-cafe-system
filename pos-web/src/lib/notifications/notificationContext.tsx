"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { useSSE } from "../hooks/useSSE";
import { authStorage, AUTH_CHANGE_EVENT } from "../authStorage";

export type NewOrderNotification = {
  orderId: string;
  orderNumber: string;
  totalDue: number;
  cashierId: string;
  status: string;
  createdAt: string;
  itemCount: number;
};

type Notification = {
  id: string;
  type: "new_order";
  data: NewOrderNotification;
  timestamp: Date;
  read: boolean;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  isConnected: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

type NotificationProviderProps = {
  children: ReactNode;
  enabled?: boolean;
};

export function NotificationProvider({
  children,
  enabled = true,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = () => {
      const user = authStorage.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    // Listen for auth changes
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    };
  }, []);

  const handleNewOrder = useCallback((eventData: { data?: unknown }) => {
    if (eventData.data && typeof eventData.data === "object") {
      const orderData = eventData.data as NewOrderNotification;
      
      const notification: Notification = {
        id: `order-${orderData.orderId}-${Date.now()}`,
        type: "new_order",
        data: orderData,
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [notification, ...prev]);

      // Optional: Play notification sound
      if (typeof window !== "undefined" && "Audio" in window) {
        try {
          // You can add a notification sound file here
          // const audio = new Audio("/notification.mp3");
          // audio.play().catch(() => {});
        } catch {
          // Ignore audio errors
        }
      }

      // Optional: Show browser notification if permission granted
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("New Order", {
          body: `Order ${orderData.orderNumber} - ₱${orderData.totalDue.toFixed(2)}`,
          icon: "/kyla-cafe-system-logo.png",
          tag: orderData.orderId,
        });
      }
    }
  }, []);

  const { isConnected } = useSSE({
    onMessage: (event) => {
      if (event.type === "new_order") {
        handleNewOrder(event);
      }
    },
    enabled: enabled && isAuthenticated, // Only connect when authenticated
  });

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        isConnected,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

