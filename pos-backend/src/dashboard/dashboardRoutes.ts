import { Router } from "express";

import { authenticateUser } from "../auth/authMiddleware";
import { getDashboardMetrics } from "./dashboardService";

const dashboardRouter = Router();

dashboardRouter.use(authenticateUser);

dashboardRouter.get("/metrics", async (_req, res, next) => {
  try {
    const metrics = await getDashboardMetrics();
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

export default dashboardRouter;



