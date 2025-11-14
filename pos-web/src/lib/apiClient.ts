import { authStorage } from "./authStorage";
import { getUnauthorizedHandler } from "./authEvents";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:4000";

type RequestOptions = RequestInit & {
  parseJson?: boolean;
};

type ApiError = Error & {
  status?: number;
  details?: unknown;
};

export async function apiRequest<TResponse>(
  path: string,
  { parseJson = true, headers, ...init }: RequestOptions = {}
): Promise<TResponse> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const buildHeaders = () => {
    const finalHeaders = new Headers({
      "Content-Type": "application/json",
    });

    if (headers) {
      const provided = new Headers(headers);
      provided.forEach((value, key) => {
        finalHeaders.set(key, value);
      });
    }

    const nextToken = authStorage.getAccessToken();
    if (nextToken) {
      finalHeaders.set("Authorization", `Bearer ${nextToken}`);
    }

    return finalHeaders;
  };

  const requestInit: RequestInit = {
    ...init,
  };

  let hasRetriedAfterUnauthorized = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetch(url, {
      ...requestInit,
      headers: buildHeaders(),
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let details: unknown;

      try {
        details = await response.json();

        if (
          typeof details === "object" &&
          details !== null &&
          "error" in details &&
          typeof (details as { error: unknown }).error === "string"
        ) {
          errorMessage = (details as { error: string }).error;
        }
      } catch {
        // Ignore JSON parsing failures for error responses.
      }

      const error = new Error(errorMessage) as ApiError;
      error.status = response.status;
      error.details = details;

      const handler = getUnauthorizedHandler();
      const normalizedMessage = errorMessage
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, "");
      if (
        normalizedMessage === "invalid or expired access token" &&
        !hasRetriedAfterUnauthorized &&
        handler
      ) {
        hasRetriedAfterUnauthorized = true;
        try {
          await handler();
          continue;
        } catch {
          throw error;
        }
      }

      throw error;
    }

    if (!parseJson) {
      // @ts-expect-error -- caller opts-out of JSON parsing and handles the response manually.
      return response;
    }

    return (await response.json()) as TResponse;
  }
}

export type { ApiError };
