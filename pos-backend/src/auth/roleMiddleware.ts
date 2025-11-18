import type { NextFunction, Request, Response } from "express";
import { UserRole } from "../generated/prisma/client";
import { HttpError } from "../lib/httpError";
import prisma from "../lib/prisma";

export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new HttpError(401, "Authentication required.");
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: true },
      });

      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      if (!allowedRoles.includes(user.role)) {
        throw new HttpError(
          403,
          `Access denied. Required role: ${allowedRoles.join(" or ")}.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }

      next(
        new HttpError(500, "An error occurred while checking permissions.", {
          cause: error,
        })
      );
    }
  };
};

export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

