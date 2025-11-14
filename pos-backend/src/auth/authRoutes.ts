import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import {
  getCurrentUser,
  loginUser,
  logout,
  refreshTokens,
  registerUser,
  expireUserTokens,
} from "./authService";
import { authenticateUser } from "./authMiddleware";
import { HttpError } from "../lib/httpError";
import { revokeAccessToken } from "./tokenBlacklist";

const authRouter = Router();

type CredentialsBody = {
  email?: string;
  password?: string;
};

type RegisterBody = CredentialsBody & {
  businessName?: string;
  industry?: string;
  fullName?: string;
  contactNumber?: string;
};

type RefreshBody = {
  refreshToken?: string;
};

type ExpireBody = {
  userId?: string;
};

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const extractTokenMetadata = (req: Request) => ({
  userAgent: req.get("user-agent") ?? null,
  ipAddress: req.ip ?? null,
});

const extractBearerToken = (req: Request) => {
  const bearer = req.headers.authorization;
  if (typeof bearer === "string") {
    const [, token] = bearer.split(" ");
    return token;
  }
  return null;
};

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const {
      email = "",
      password = "",
      businessName = "",
      industry,
      fullName,
      contactNumber,
    } = req.body as RegisterBody;
    const authResult = await registerUser({
      email,
      password,
      profile: {
        businessName,
        industry: industry ?? null,
        fullName: fullName ?? null,
        contactNumber: contactNumber ?? null,
      },
      ...extractTokenMetadata(req),
    });

    // Consider setting httpOnly, secure cookies here for web clients:
    // res.cookie("accessToken", authResult.accessToken, { httpOnly: true, secure: true, sameSite: "strict" });
    // res.cookie("refreshToken", authResult.refreshToken, { httpOnly: true, secure: true, sameSite: "strict" });

    res.status(201).json(authResult);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email = "", password = "" } = req.body as CredentialsBody;
    const authResult = await loginUser({
      email,
      password,
      ...extractTokenMetadata(req),
    });

    res.json(authResult);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken = "" } = req.body as RefreshBody;
    const authResult = await refreshTokens({
      refreshToken,
      ...extractTokenMetadata(req),
    });

    res.json(authResult);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken = "" } = req.body as RefreshBody;
    await logout({ refreshToken });

    // If you opt into cookie-based auth, remember to clear them here.
    res.status(204).send();
  })
);

authRouter.post(
  "/expire",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { userId = "" } = req.body as ExpireBody;

    if (!userId) {
      throw new HttpError(400, "User identifier is required.");
    }

    if (req.user?.id !== userId) {
      throw new HttpError(403, "You can only expire your own session.");
    }

    const token = extractBearerToken(req);

    if (!token) {
      throw new HttpError(400, "Authorization token is required.");
    }

    await expireUserTokens(userId);
    revokeAccessToken(token);

    res.json({ message: "Access token expired" });
  })
);

authRouter.get(
  "/me",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const currentUser = await getCurrentUser(req.user!.id);
    res.json({ user: currentUser });
  })
);

export default authRouter;
