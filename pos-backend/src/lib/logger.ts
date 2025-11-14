type LogMeta = Record<string, unknown>;

const format = (level: string, message: string): string =>
  `[${new Date().toISOString()}] [${level}] ${message}`;

const output = (
  level: "info" | "warn" | "error",
  message: string,
  meta?: LogMeta
) => {
  const formattedMessage = format(level.toUpperCase(), message);

  if (!meta) {
    // eslint-disable-next-line no-console
    console[level](formattedMessage);
    return;
  }

  // eslint-disable-next-line no-console
  console[level](formattedMessage, meta);
};

export const serializeError = (error: unknown): LogMeta => {
  if (error instanceof Error) {
    const hasCause = Object.prototype.hasOwnProperty.call(error, "cause");
    const causeValue = hasCause
      ? // @ts-expect-error - cause is available in newer runtimes; guard ensures safe access.
        error.cause
      : undefined;

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        causeValue && typeof causeValue === "object"
          ? serializeError(causeValue)
          : causeValue ?? null,
    };
  }

  return { value: error };
};

export const logger = {
  info: (message: string, meta?: LogMeta) => output("info", message, meta),
  warn: (message: string, meta?: LogMeta) => output("warn", message, meta),
  error: (message: string, meta?: LogMeta) => output("error", message, meta),
};
