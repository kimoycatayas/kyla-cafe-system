import { config } from "./config";
import { storage } from "./storage";

/**
 * API client for making requests to the backend
 */

export interface ApiError {
  message: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Log request details in development
    if (__DEV__) {
      console.log(`[API Request] ${options.method || "GET"} ${url}`);
      console.log("[API Headers]", headers);
      if (options.body) {
        console.log("[API Body]", options.body);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Log response details in development
      if (__DEV__) {
        console.log(`[API Response] ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Backend returns { error: string } format
        const errorMessage =
          (errorData as { error?: string }).error ||
          (errorData as { message?: string }).message ||
          response.statusText ||
          "An error occurred";
        throw {
          message: errorMessage,
          status: response.status,
        } as ApiError;
      }

      return await response.json();
    } catch (error) {
      // Enhanced error logging
      if (__DEV__) {
        console.error("[API Error]", error);
        console.error("[API URL]", url);
        console.error("[API Error Details]", {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "Unknown",
        });
      }

      if (error && typeof error === "object" && "message" in error) {
        throw error;
      }
      throw {
        message: `Network error. Please check your connection and API URL: ${this.baseUrl}`,
        status: 0,
      } as ApiError;
    }
  }

  private async getToken(): Promise<string | null> {
    return await storage.getAccessToken();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient(config.apiUrl);
