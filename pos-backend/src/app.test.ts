import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
  process.env.JWT_ACCESS_EXPIRES_IN =
    process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
  process.env.JWT_REFRESH_EXPIRES_IN =
    process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
  return {};
});

const queryRawMock = vi.hoisted(() => vi.fn());

vi.mock("./lib/prisma", () => ({
  default: {
    $queryRaw: queryRawMock,
  },
}));

import app from "./app";

describe("GET /health/db", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("responds with ok when the database query succeeds", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("responds with error when the database query fails", async () => {
    const error = new Error("Database unavailable");
    queryRawMock.mockRejectedValueOnce(error);

    const response = await request(app).get("/health/db");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: "error", error: error.message });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});
