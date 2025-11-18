import { UserRole } from "../generated/prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";

export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    businessName: string;
    industry?: string | null;
    fullName?: string | null;
    contactNumber?: string | null;
  } | null;
};

export type UpdateUserRoleInput = {
  role: UserRole;
};

const mapUser = (user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    businessName: string;
    industry?: string | null;
    fullName?: string | null;
    contactNumber?: string | null;
  } | null;
}): UserResponse => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile
      ? {
          businessName: user.profile.businessName,
          industry: user.profile.industry ?? null,
          fullName: user.profile.fullName ?? null,
          contactNumber: user.profile.contactNumber ?? null,
        }
      : null,
  };
};

export const listUsers = async (): Promise<UserResponse[]> => {
  const users = await prisma.user.findMany({
    include: {
      profile: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return users.map(mapUser);
};

export const getUserById = async (userId: string): Promise<UserResponse> => {
  if (!userId) {
    throw new HttpError(400, "User identifier is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return mapUser(user);
};

export const updateUserRole = async (
  userId: string,
  input: UpdateUserRoleInput
): Promise<UserResponse> => {
  if (!userId) {
    throw new HttpError(400, "User identifier is required.");
  }

  const validRoles = Object.values(UserRole);
  if (!validRoles.includes(input.role)) {
    throw new HttpError(400, `Invalid role. Must be one of: ${validRoles.join(", ")}.`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      role: input.role,
    },
    include: {
      profile: true,
    },
  });

  return mapUser(updatedUser);
};

