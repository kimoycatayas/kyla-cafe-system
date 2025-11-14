if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
}

if (!process.env.JWT_ACCESS_EXPIRES_IN) {
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
}

if (!process.env.JWT_REFRESH_EXPIRES_IN) {
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://test-user:test-pass@localhost:5432/pos_test";
}

