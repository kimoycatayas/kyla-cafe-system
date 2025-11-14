import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "./jwt";
import { HttpError, isHttpError } from "../lib/httpError";
import { isAccessTokenRevoked } from "./tokenBlacklist";

const extractBearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;

  if (typeof header !== "string") {
    return undefined;
  }

  const [scheme, value] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return undefined;
  }

  return value.trim();
};

const resolveTokenOrThrow = async (
  token: string
): Promise<{ id: string; role?: string | null }> => {
  const payload = await verifyAccessToken(token);

  const result: { id: string; role?: string | null } = {
    id: payload.userId,
  };

  if (typeof payload.role === "string") {
    result.role = payload.role;
  } else if (payload.role === null) {
    result.role = null;
  }

  return result;
};

export const authenticateUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new HttpError(401, "Authorization token is required.");
    }

    if (isAccessTokenRevoked(token)) {
      throw new HttpError(401, "Invalid or expired access token.");
    }

    req.user = await resolveTokenOrThrow(token);
    next();
  } catch (error) {
    if (isHttpError(error)) {
      next(error);
      return;
    }

    next(
      new HttpError(401, "Invalid or expired access token.", { cause: error })
    );
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      next();
      return;
    }

    req.user = await resolveTokenOrThrow(token);
    next();
  } catch {
    // Optional auth swallows verification issues to keep routes publicly accessible.
    next();
  }
};
