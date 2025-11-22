import { apiClient, ApiError } from "./api";
import { storage } from "./storage";

/**
 * Authentication client for login, signup, and token management
 */

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  role?: string | null;
  profile?: {
    businessName: string;
    industry?: string | null;
    fullName?: string | null;
    contactNumber?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  businessName: string;
  industry?: string | null;
  fullName?: string | null;
  contactNumber?: string | null;
}

/**
 * Login user with email and password
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>("/auth/login", {
      email: payload.email,
      password: payload.password,
    });

    // Store tokens and user data
    await storage.setAccessToken(response.accessToken);
    await storage.setRefreshToken(response.refreshToken);
    await storage.setUser(response.user);

    return response;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to login. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Register a new user
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>("/auth/register", {
      email: payload.email,
      password: payload.password,
      businessName: payload.businessName,
      industry: payload.industry ?? null,
      fullName: payload.fullName ?? null,
      contactNumber: payload.contactNumber ?? null,
    });

    // Store tokens and user data
    await storage.setAccessToken(response.accessToken);
    await storage.setRefreshToken(response.refreshToken);
    await storage.setUser(response.user);

    return response;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to register. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Logout user and clear tokens
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await storage.getRefreshToken();
    if (refreshToken) {
      // Call logout endpoint if needed
      // await apiClient.post("/auth/logout", { refreshToken });
    }
  } catch (error) {
    // Continue with logout even if API call fails
    console.error("Logout API call failed:", error);
  } finally {
    // Always clear tokens locally
    await storage.clearTokens();
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<{ user: User }>("/auth/me");
  return response.user;
}

