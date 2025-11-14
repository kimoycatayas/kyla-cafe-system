import type { AuthenticatedUser } from "../auth/authService";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<AuthenticatedUser, "id" | "role">;
    }
  }
}

export {};
