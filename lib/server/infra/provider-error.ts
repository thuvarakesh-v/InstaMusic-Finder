export type ProviderErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_INPUT"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_ACCESS_DENIED"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_INVALID_RESPONSE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "QUEUE_SATURATED"
  | "INFRASTRUCTURE_UNAVAILABLE";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(options: {
    code: ProviderErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    retryAfterSeconds?: number | null;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = options.code;
    this.status = options.status ?? 502;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
