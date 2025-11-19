"use client";

import { useEffect, useRef, useState } from "react";
import { authStorage } from "../authStorage";

function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!envUrl) {
    return "http://localhost:4000";
  }

  const cleanUrl = envUrl.replace(/\/+$/, "");

  if (!cleanUrl.match(/^https?:\/\//i)) {
    return `https://${cleanUrl}`;
  }

  return cleanUrl;
}

const API_BASE_URL = getApiBaseUrl();

type SSEEventData = {
  type: string;
  data?: unknown;
  message?: string;
  timestamp: string;
};

type UseSSEOptions = {
  onMessage?: (event: SSEEventData) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  enabled?: boolean;
};

export function useSSE(options: UseSSEOptions = {}) {
  const { onMessage, onError, onOpen, onClose, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const token = authStorage.getAccessToken();
    if (!token) {
      console.warn("[SSE] No access token, skipping connection");
      return;
    }

    const connect = () => {
      try {
        // EventSource doesn't support custom headers, so we pass token via query param
        const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(
          token
        )}`;

        const eventSource = new EventSource(url, {
          withCredentials: true,
        });

        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log("[SSE] Connected to notification stream", {
            readyState: eventSource.readyState,
            url: eventSource.url,
          });
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset on successful connection
          onOpen?.();
        };

        eventSource.onerror = (err) => {
          const state = eventSource.readyState;
          console.error("[SSE] Connection error", {
            readyState: state,
            // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
            state: state === 0 ? "CONNECTING" : state === 1 ? "OPEN" : "CLOSED",
          });

          // Only treat as error if connection is actually closed
          // EventSource might fire error events during normal operation
          if (state === EventSource.CLOSED) {
            setError(new Error("SSE connection closed"));
            setIsConnected(false);
            onError?.(err);

            // Attempt reconnection only if connection is actually closed
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current += 1;
              console.log(
                `[SSE] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
              );
              reconnectTimeoutRef.current = setTimeout(() => {
                if (eventSourceRef.current) {
                  eventSourceRef.current.close();
                }
                connect();
              }, reconnectDelay);
            } else {
              console.error("[SSE] Max reconnection attempts reached");
              onClose?.();
            }
          } else if (state === EventSource.CONNECTING) {
            // Connection is still trying to connect, don't treat as error yet
            console.log("[SSE] Still connecting...");
          }
        };

        // Listen for custom events
        eventSource.addEventListener("new_order", (event) => {
          try {
            const data = JSON.parse(event.data) as SSEEventData;
            onMessage?.(data);
          } catch (err) {
            console.error("[SSE] Failed to parse message", err);
          }
        });

        // Listen for connection confirmation
        eventSource.addEventListener("connected", (event) => {
          try {
            const data = JSON.parse(event.data) as SSEEventData;
            console.log("[SSE]", data.message);
          } catch (err) {
            console.error("[SSE] Failed to parse connection message", err);
          }
        });

        // Listen for heartbeat (comments)
        eventSource.addEventListener("message", (event) => {
          // Handle any other messages
          try {
            const data = JSON.parse(event.data) as SSEEventData;
            onMessage?.(data);
          } catch {
            // Ignore non-JSON messages (like heartbeat comments)
          }
        });
      } catch (err) {
        console.error("[SSE] Failed to create connection", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      onClose?.();
    };
  }, [enabled, onMessage, onError, onOpen, onClose]);

  return {
    isConnected,
    error,
    reconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      reconnectAttemptsRef.current = 0;
      // Trigger reconnection via useEffect
      setIsConnected(false);
    },
  };
}
