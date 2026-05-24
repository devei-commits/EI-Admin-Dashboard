/**
 * API client for admin dashboard backend.
 * Base URL: /api (proxied to backend in dev) or VITE_API_BASE_URL.
 * Attaches Bearer token from localStorage when present.
 */

const AUTH_TOKEN_KEY = 'ei_admin_token';
const AUTH_USER_STORAGE_KEY = 'eisthetic_auth_user';
export const SESSION_EXPIRED_EVENT = 'ei:session-expired';

const SESSION_EXPIRED_MESSAGE = 'Session expired. Please log in again.';

export function getApiBaseUrl(): string {
 return typeof import.meta.env?.VITE_API_BASE_URL === 'string' && import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '';
}

export function getAuthToken(): string | null {
 try {
  return localStorage.getItem(AUTH_TOKEN_KEY);
 } catch {
  return null;
 }
}

export function setAuthToken(token: string): void {
 localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
 localStorage.removeItem(AUTH_TOKEN_KEY);
}

function getHeaders(includeAuth = true, body?: BodyInit | null): HeadersInit {
 const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
 const headers: HeadersInit = {};
 if (!isFormData) {
  (headers as Record<string, string>)['Content-Type'] = 'application/json';
 }
 if (includeAuth) {
  const token = getAuthToken();
  if (token) {
   (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
 }
 return headers;
}

function buildUrl(path: string): string {
 const base = getApiBaseUrl();
 const p = path.startsWith('/') ? path : `/${path}`;
 return base ? `${base}${p}` : p;
}

function isSessionExpiredPayload(status: number, body: unknown): boolean {
 if (body && typeof body === 'object') {
  const o = body as Record<string, unknown>;
  const code = String(o.code ?? '').toUpperCase();
  if (code === 'SESSION_EXPIRED') return true;
  if (status === 401 && code === 'UNAUTHORIZED') return true;
  const msg = String(o.message ?? o.error ?? '').toLowerCase();
  if (/session expired|please log in again/.test(msg)) return true;
 }
 if (typeof body === 'string') {
  const t = body.trim();
  if (/session expired|please log in again/i.test(t)) return true;
  if (status === 403 && /^forbidden$/i.test(t)) return true;
 }
 return false;
}

function notifySessionExpired(message: string): void {
 clearAuthToken();
 try {
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
 } catch {
  // ignore
 }
 if (typeof window !== 'undefined') {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { message } }));
 }
}

/** Prefer API JSON `{ error }` / `{ message }` over generic HTTP status text. */
function extractServerErrorMessage(body: unknown, status?: number): string | null {
 if (body == null) {
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return null;
  return null;
 }
 if (typeof body === 'string') {
  const t = body.trim();
  if (!t) {
   if (status === 401) return SESSION_EXPIRED_MESSAGE;
   return null;
  }
  if (/^forbidden$/i.test(t) && (status === 401 || status === 403)) return SESSION_EXPIRED_MESSAGE;
  return t;
 }
 if (typeof body === 'object') {
  const o = body as Record<string, unknown>;
  const code = String(o.code ?? '').toUpperCase();
  if (code === 'SESSION_EXPIRED') {
   return typeof o.message === 'string' && o.message.trim()
    ? o.message.trim()
    : SESSION_EXPIRED_MESSAGE;
  }
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
 }
 if (status === 401) return SESSION_EXPIRED_MESSAGE;
 return null;
}

function resolveHttpErrorMessage(status: number, statusText: string, body: unknown): string {
 const serverMessage = extractServerErrorMessage(body, status);
 if (serverMessage) return serverMessage;
 if (status === 401) return SESSION_EXPIRED_MESSAGE;
 if (status === 403) {
  return 'You do not have permission to perform this action, or your session has expired. Please log in again.';
 }
 return `HTTP ${status}: ${statusText || 'Request failed'}`;
}

export async function apiRequest<T>(
 path: string,
 options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
 const { skipAuth, ...init } = options;
 const url = buildUrl(path);
 const response = await fetch(url, {
  ...init,
  credentials: 'include',
  headers: { ...getHeaders(!skipAuth, init.body ?? null), ...(init.headers as HeadersInit) },
 });
 if (!response.ok) {
  // Read the body once to avoid "body stream already read" error
  const text = await response.text();
  let body: unknown;
  try {
   body = JSON.parse(text);
  } catch {
   body = text;
  }

  const hadAuthToken = !skipAuth && Boolean(getAuthToken());
  if (hadAuthToken && isSessionExpiredPayload(response.status, body)) {
   const message = resolveHttpErrorMessage(response.status, response.statusText, body);
   notifySessionExpired(message);
   const err = new Error(message) as Error & { status: number; body?: unknown; sessionExpired?: boolean };
   err.status = response.status;
   err.body = body;
   err.sessionExpired = true;
   throw err;
  }

  const message = resolveHttpErrorMessage(response.status, response.statusText, body);
  const err = new Error(message) as Error & { status: number; body?: unknown };
  err.status = response.status;
  err.body = body;
  throw err;
 }
 if (response.status === 204) return undefined as T;
 return response.json();
}

export const api = {
 get: <T>(path: string, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'GET' }),
 post: <T>(path: string, data?: unknown, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, {
   ...options,
   method: 'POST',
   body:
    data != null
     ? typeof FormData !== 'undefined' && data instanceof FormData
       ? data
       : JSON.stringify(data)
     : undefined,
  }),
 put: <T>(path: string, data?: unknown, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'PUT', body: data != null ? JSON.stringify(data) : undefined }),
 patch: <T>(path: string, data?: unknown, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'PATCH', body: data != null ? JSON.stringify(data) : undefined }),
 delete: <T>(path: string, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
