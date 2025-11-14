import { SignJWT, jwtVerify } from "jose";

import { authConfig } from "../config/authConfig";
import { HttpError } from "../lib/httpError";

type AccessTokenClaims = {
  userId: string;
  role?: string | null | undefined;
};

type RefreshTokenClaims = {
  userId: string;
  tokenId: string;
};

export type DecodedAccessPayload = {
  userId: string;
  iat: number;
  exp: number;
  role?: string | null;
};

export type DecodedRefreshPayload = RefreshTokenClaims & {
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();
const accessSecret = encoder.encode(authConfig.accessTokenSecret);
const refreshSecret = encoder.encode(authConfig.refreshTokenSecret);

const buildClaims = <T extends object>(claims: T) =>
  Object.entries(claims).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }

      return acc;
    },
    {}
  );

export const signAccessToken = async (
  payload: AccessTokenClaims
): Promise<string> =>
  new SignJWT(buildClaims(payload))
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(authConfig.accessTokenExpiresIn)
    .sign(accessSecret);

export const signRefreshToken = async (
  payload: RefreshTokenClaims
): Promise<string> =>
  new SignJWT(buildClaims(payload))
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(authConfig.refreshTokenExpiresIn)
    .sign(refreshSecret);

export const verifyAccessToken = async (
  token: string
): Promise<DecodedAccessPayload> => {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    const userId = payload.userId;

    if (typeof userId !== "string" || userId.length === 0) {
      throw new HttpError(401, "Invalid access token payload");
    }

    const result: DecodedAccessPayload = {
      userId,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };

    if (typeof payload.role === "string") {
      result.role = payload.role;
    } else if (payload.role === null) {
      result.role = null;
    }

    return result;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Invalid or expired access token", {
      cause: error,
    });
  }
};

export const verifyRefreshToken = async (
  token: string
): Promise<DecodedRefreshPayload> => {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    const userId = payload.userId;
    const tokenId = payload.tokenId;

    if (typeof userId !== "string" || userId.length === 0) {
      throw new HttpError(
        401,
        "Invalid refresh token payload (missing userId)"
      );
    }

    if (typeof tokenId !== "string" || tokenId.length === 0) {
      throw new HttpError(
        401,
        "Invalid refresh token payload (missing tokenId)"
      );
    }

    return {
      userId,
      tokenId,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Invalid or expired refresh token", {
      cause: error,
    });
  }
};
