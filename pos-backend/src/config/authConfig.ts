const requiredEnvVars = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] || process.env[envVar]?.trim() === "") {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const accessTokenSecret = process.env.JWT_ACCESS_SECRET as string;
const refreshTokenSecret = process.env.JWT_REFRESH_SECRET as string;
const accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN as string;
const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN as string;

export const authConfig = {
  accessTokenSecret,
  refreshTokenSecret,
  accessTokenExpiresIn,
  refreshTokenExpiresIn,
} as const;

export type AuthConfig = typeof authConfig;
