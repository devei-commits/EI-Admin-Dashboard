/**
 * API client for admin dashboard backend.
 * Base URL: /api (proxied to backend in dev) or VITE_API_BASE_URL.
 * Attaches Bearer token from localStorage when present.
 */

const AUTH_TOKEN_KEY = 'ei_admin_token';

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

function getHeaders(includeAuth = true): HeadersInit {
 const headers: HeadersInit = {
  'Content-Type': 'application/json',
 };
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

/** Prefer API JSON `{ error }` / `{ message }` over generic HTTP status text. */
function extractServerErrorMessage(body: unknown): string | null {
 if (body == null) return null;
 if (typeof body === 'string' && body.trim()) return body.trim();
 if (typeof body === 'object') {
  const o = body as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
 }
 return null;
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
  headers: { ...getHeaders(!skipAuth), ...(init.headers as HeadersInit) },
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

  const serverMessage = extractServerErrorMessage(body);
  const fallback = `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
  const err = new Error(serverMessage || fallback) as Error & { status: number; body?: unknown };
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
  apiRequest<T>(path, { ...options, method: 'POST', body: data != null ? JSON.stringify(data) : undefined }),
 put: <T>(path: string, data?: unknown, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'PUT', body: data != null ? JSON.stringify(data) : undefined }),
 patch: <T>(path: string, data?: unknown, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'PATCH', body: data != null ? JSON.stringify(data) : undefined }),
 delete: <T>(path: string, options?: RequestInit & { skipAuth?: boolean }) =>
  apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
