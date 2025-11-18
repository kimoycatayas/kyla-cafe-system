import { apiRequest } from "./apiClient";

export type UserRole = "CASHIER" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  profile?: {
    businessName: string;
    industry?: string | null;
    fullName?: string | null;
    contactNumber?: string | null;
  } | null;
};

export type UsersResponse = {
  users: User[];
};

export type UserResponse = {
  user: User;
};

export type UpdateUserRolePayload = {
  role: UserRole;
};

export async function fetchUsers(): Promise<User[]> {
  const response = await apiRequest<UsersResponse>("/users", {
    method: "GET",
    parseJson: true,
  });
  return response.users;
}

export async function getUserById(userId: string): Promise<User> {
  const response = await apiRequest<UserResponse>(`/users/${userId}`, {
    method: "GET",
    parseJson: true,
  });
  return response.user;
}

export async function updateUserRole(
  userId: string,
  payload: UpdateUserRolePayload
): Promise<User> {
  const response = await apiRequest<UserResponse>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    parseJson: true,
  });
  return response.user;
}

