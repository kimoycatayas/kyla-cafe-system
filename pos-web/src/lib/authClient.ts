import { apiRequest } from "./apiClient";
import type { AuthPayload } from "./authStorage";

type AuthResponse = {
  user: {
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
  };
  accessToken: string;
  refreshToken: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  businessName: string;
  industry?: string | null;
  fullName?: string | null;
  contactNumber?: string | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await apiRequest<Response>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    parseJson: false,
  });
}

export async function expireUserAccessToken(userId: string): Promise<void> {
  await apiRequest("/auth/expire", {
    method: "POST",
    body: JSON.stringify({ userId }),
    parseJson: true,
  });
}

export type { AuthResponse };

export const toAuthPayload = (response: AuthResponse): AuthPayload => ({
  accessToken: response.accessToken,
  refreshToken: response.refreshToken,
  user: response.user,
});
