export class HttpError extends Error {
  readonly statusCode: number;

  constructor(
    statusCode: number,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message);

    if (options?.cause !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }

    this.statusCode = statusCode;
    this.name = "HttpError";
  }
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;
