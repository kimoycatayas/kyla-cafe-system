import type { Request, Response } from "express";
import { Router } from "express";
import { authenticateUser } from "../auth/authMiddleware";
import { requireSuperAdmin } from "../auth/roleMiddleware";
import * as userService from "./userService";
import { HttpError } from "../lib/httpError";

const asyncHandler = (
  fn: (req: Request, res: Response) => Promise<void>
) => {
  return async (req: Request, res: Response, next: (err?: unknown) => void) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
};

const userRouter = Router();

userRouter.use(authenticateUser);
userRouter.use(requireSuperAdmin);

userRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await userService.listUsers();
    res.json({ users });
  })
);

userRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
      throw new HttpError(400, "User identifier is required.");
    }

    const user = await userService.getUserById(userId);
    res.json({ user });
  })
);

userRouter.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
      throw new HttpError(400, "User identifier is required.");
    }

    const { role } = req.body as { role?: string };

    if (!role) {
      throw new HttpError(400, "Role is required.");
    }

    const updatedUser = await userService.updateUserRole(userId, { role: role as any });
    res.json({ user: updatedUser });
  })
);

export default userRouter;

