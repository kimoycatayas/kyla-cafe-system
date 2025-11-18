import { createHash, randomUUID } from "node:crypto";

import type { Prisma, User, BusinessProfile } from "../generated/prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../lib/httpError";
import { authConfig } from "../config/authConfig";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken as verifyRefreshTokenJwt,
} from "./jwt";
import { hashPassword, verifyPassword } from "./password";

type PrismaClientOrTransaction = Prisma.TransactionClient | typeof prisma;

type TokenMetadata = {
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
};

export type UserProfile = {
  businessName: string;
  industry?: string | null;
  fullName?: string | null;
  contactNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthenticatedUser = Pick<
  User,
  "id" | "email" | "createdAt" | "updatedAt"
> & {
  role?: string | null | undefined;
  profile?: UserProfile | null;
};

export type AuthenticatedResponse = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};

export type BusinessProfileInput = {
  businessName: string;
  industry?: string | null;
  fullName?: string | null;
  contactNumber?: string | null;
};

export type RegisterUserInput = {
  email: string;
  password: string;
  profile: BusinessProfileInput;
} & TokenMetadata;

export type LoginUserInput = {
  email: string;
  password: string;
} & TokenMetadata;

export type RefreshTokensInput = {
  refreshToken: string;
} & TokenMetadata;

const DURATION_MULTIPLIERS_IN_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const durationToMs = (value: string): number => {
  const match = value.trim().match(/^(\d+)\s*([smhdw])$/i);

  if (!match) {
    throw new Error(
      `Invalid duration format "${value}". Expected formats like 15m, 7d, 1h.`
    );
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multiplier = DURATION_MULTIPLIERS_IN_MS[unit];

  if (!multiplier) {
    throw new Error(`Unsupported duration unit "${unit}" in "${value}".`);
  }

  return amount * multiplier;
};

const calculateExpiryDate = (duration: string): Date =>
  new Date(Date.now() + durationToMs(duration));

const hashTokenValue = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const sanitizeEmail = (email: string): string => email.trim().toLowerCase();

const sanitizeProfileInput = (profile: BusinessProfileInput): {
  businessName: string;
  industry: string | null;
  fullName: string | null;
  contactNumber: string | null;
} => {
  const sanitizeOptional = (value?: string | null) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  };

  const businessName = profile.businessName?.trim();

  if (!businessName) {
    throw new HttpError(400, "Business name is required.");
  }

  return {
    businessName,
    industry: sanitizeOptional(profile.industry),
    fullName: sanitizeOptional(profile.fullName),
    contactNumber: sanitizeOptional(profile.contactNumber),
  };
};

const mapProfile = (
  profile: BusinessProfile | null | undefined,
): UserProfile | null => {
  if (!profile) {
    return null;
  }

  return {
    businessName: profile.businessName,
    industry: profile.industry ?? null,
    fullName: profile.fullName ?? null,
    contactNumber: profile.contactNumber ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

const toAuthenticatedUser = (
  user: User & { profile?: BusinessProfile | null },
): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  role: user.role,
  profile: mapProfile(user.profile ?? null),
});

const createRefreshTokenRecord = async (
  client: PrismaClientOrTransaction,
  userId: string,
  metadata: TokenMetadata
): Promise<{ token: string; tokenId: string; expiresAt: Date }> => {
  const refreshTokenId = randomUUID();
  const jwt = await signRefreshToken({ userId, tokenId: refreshTokenId });
  const hashedToken = hashTokenValue(jwt);
  const expiresAt = calculateExpiryDate(authConfig.refreshTokenExpiresIn);

  await client.refreshToken.create({
    data: {
      id: refreshTokenId,
      token: hashedToken,
      userId,
      expiresAt,
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null,
    },
  });

  return { token: jwt, tokenId: refreshTokenId, expiresAt };
};

const validateEmailAndPassword = (email: string, password: string) => {
  if (!email || email.trim().length === 0) {
    throw new HttpError(400, "Email is required");
  }

  if (!password || password.length < 8) {
    throw new HttpError(
      400,
      "Password must be at least 8 characters long to satisfy minimum security requirements."
    );
  }
};

export const registerUser = async (
  input: RegisterUserInput
): Promise<AuthenticatedResponse> => {
  const normalizedEmail = sanitizeEmail(input.email);
  validateEmailAndPassword(normalizedEmail, input.password);
  const sanitizedProfile = sanitizeProfileInput(input.profile);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      profile: {
        create: {
          businessName: sanitizedProfile.businessName,
          industry: sanitizedProfile.industry,
          fullName: sanitizedProfile.fullName,
          contactNumber: sanitizedProfile.contactNumber,
        },
      },
    },
    include: { profile: true },
  });

  const [accessToken, refreshTokenRecord] = await Promise.all([
    signAccessToken({ userId: user.id, role: user.role }),
    createRefreshTokenRecord(prisma, user.id, input),
  ]);

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: refreshTokenRecord.token,
  };
};

export const loginUser = async (
  input: LoginUserInput
): Promise<AuthenticatedResponse> => {
  const normalizedEmail = sanitizeEmail(input.email);
  validateEmailAndPassword(normalizedEmail, input.password);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash
  );

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const [accessToken, refreshTokenRecord] = await Promise.all([
    signAccessToken({ userId: user.id, role: user.role }),
    createRefreshTokenRecord(prisma, user.id, input),
  ]);

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: refreshTokenRecord.token,
  };
};

export const refreshTokens = async (
  input: RefreshTokensInput
): Promise<AuthenticatedResponse> => {
  if (!input.refreshToken) {
    throw new HttpError(400, "Refresh token is required.");
  }

  const decoded = await verifyRefreshTokenJwt(input.refreshToken);
  const hashedProvidedToken = hashTokenValue(input.refreshToken);
  const now = new Date();

  const { user, refreshToken } = await prisma.$transaction(async (tx) => {
    const storedToken = await tx.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: { user: { include: { profile: true } } },
    });

    if (!storedToken) {
      throw new HttpError(401, "Refresh token is invalid or has been revoked.");
    }

    if (storedToken.token !== hashedProvidedToken) {
      throw new HttpError(401, "Refresh token is invalid or has been rotated.");
    }

    if (storedToken.userId !== decoded.userId) {
      throw new HttpError(
        401,
        "Refresh token does not match the expected user."
      );
    }

    if (storedToken.revokedAt) {
      throw new HttpError(401, "Refresh token has already been used.");
    }

    if (storedToken.expiresAt <= now) {
      throw new HttpError(401, "Refresh token has expired.");
    }

    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: now },
    });

    const { token } = await createRefreshTokenRecord(
      tx,
      storedToken.userId,
      input
    );

    return { user: storedToken.user, refreshToken: token };
  });

  const accessToken = await signAccessToken({ userId: user.id, role: user.role });

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken,
  };
};

export const logout = async (input: {
  refreshToken: string;
}): Promise<void> => {
  if (!input.refreshToken) {
    throw new HttpError(400, "Refresh token is required.");
  }

  const decoded = await verifyRefreshTokenJwt(input.refreshToken);
  const hashedProvidedToken = hashTokenValue(input.refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      id: decoded.tokenId,
      token: hashedProvidedToken,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const getCurrentUser = async (
  userId: string
): Promise<AuthenticatedUser> => {
  if (!userId) {
    throw new HttpError(400, "User identifier is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return toAuthenticatedUser(user);
};

export const expireUserTokens = async (userId: string): Promise<void> => {
  if (!userId) {
    throw new HttpError(400, "User identifier is required.");
  }

  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};
