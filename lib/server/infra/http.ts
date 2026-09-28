import { type ZodType } from "zod";

import { shareInFlight } from "./inflight";
import { ProviderError } from "./provider-error";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

type FetchJsonOptions<T> = {
  url: URL;
  schema: ZodType<T>;
  init?: RequestInit;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  retryTransient?: boolean;
  sleep?: (milliseconds: number) => Promise<void>;
};

export async function fetchJson<T>(options: FetchJsonOptions<T>): Promise<T> {
  const method = options.init?.method ?? "GET";
  return shareInFlight(`${method}:${options.url.toString()}`, () => fetchJsonOnce(options));
}

async function fetchJsonOnce<T>(options: FetchJsonOptions<T>): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = options.retryTransient === false ? 1 : 2;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        options.url,
        options.init,
        options.timeoutMs ?? 6_000,
      );

      if (!response.ok) {
        throw errorFromResponse(response);
      }

      const unknownPayload = await readBoundedJson(response, options.maxBytes ?? DEFAULT_MAX_BYTES);
      const parsed = options.schema.safeParse(unknownPayload);
      if (!parsed.success) {
        throw new ProviderError({
          code: "PROVIDER_INVALID_RESPONSE",
          message: "The provider returned an unexpected response.",
          retryable: false,
          cause: parsed.error,
        });
      }
      return parsed.data;
    } catch (error) {
      const normalized = normalizeFetchError(error);
      const shouldRetry = attempt + 1 < attempts && normalized.retryable && normalized.status >= 500;
      if (!shouldRetry) throw normalized;
      await (options.sleep ?? delay)(150 + Math.floor(Math.random() * 100));
    }
  }

  throw new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "Provider request failed." });
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw invalidResponse("The provider response was too large.");
  }

  if (!response.body) throw invalidResponse("The provider returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw invalidResponse("The provider response was too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ProviderError({
      code: "PROVIDER_INVALID_RESPONSE",
      message: "The provider returned invalid JSON.",
      cause,
    });
  }
}

function errorFromResponse(response: Response): ProviderError {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
  if (response.status === 401) {
    return new ProviderError({ code: "PROVIDER_AUTH_FAILED", message: "Provider authentication failed.", status: 401 });
  }
  if (response.status === 403) {
    return new ProviderError({ code: "PROVIDER_ACCESS_DENIED", message: "Provider access was denied.", status: 403 });
  }
  if (response.status === 404) {
    return new ProviderError({ code: "PROVIDER_NOT_FOUND", message: "Provider entity was not found.", status: 404 });
  }
  if (response.status === 429) {
    return new ProviderError({
      code: "PROVIDER_RATE_LIMITED",
      message: "The provider rate limit was reached.",
      status: 429,
      retryable: true,
      retryAfterSeconds,
    });
  }
  return new ProviderError({
    code: "PROVIDER_UNAVAILABLE",
    message: "The provider is temporarily unavailable.",
    status: response.status,
    retryable: response.status >= 500,
  });
}

function normalizeFetchError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError({
      code: "PROVIDER_TIMEOUT",
      message: "The provider request timed out.",
      status: 504,
      retryable: true,
      cause: error,
    });
  }
  return new ProviderError({
    code: "PROVIDER_UNAVAILABLE",
    message: "The provider could not be reached.",
    status: 503,
    retryable: true,
    cause: error,
  });
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1_000));
}

function invalidResponse(message: string): ProviderError {
  return new ProviderError({ code: "PROVIDER_INVALID_RESPONSE", message });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
