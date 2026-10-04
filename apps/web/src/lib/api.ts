/** Minimal typed fetch helper for the same-origin backend (/api, /auth, /game). */
import i18n from '../i18n';

export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  /** Present on level upload validation failures (400 invalid_level). */
  readonly issues: string[];

  constructor(status: number, error: string, message: string, issues: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.issues = issues;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error body (proxy error, HTML page...).
  }
  if (isRecord(body)) {
    const error = typeof body.error === 'string' ? body.error : 'http_error';
    const message = typeof body.message === 'string' ? body.message : i18n.t('errors.requestFailed', { status: res.status });
    const issues = Array.isArray(body.issues) ? body.issues.filter((i): i is string => typeof i === 'string') : [];
    return new ApiError(res.status, error, message, issues);
  }
  return new ApiError(res.status, 'http_error', i18n.t('errors.requestFailed', { status: `${res.status} ${res.statusText}`.trim() }));
}

/**
 * Calls the backend and returns the parsed JSON body.
 * Resolves to `undefined` for 204 responses (type the call as `api<void>`).
 * Throws `ApiError` for non-2xx responses and for network failures (status 0).
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', i18n.t('errors.network'));
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return i18n.t('errors.unknown');
}
