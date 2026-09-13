const API_URL = import.meta.env.VITE_API_URL;

interface ApiOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  // Narrowed on purpose: RequestInit.headers is the broad HeadersInit union
  // (FormData, arrays, Headers...); we only ever pass simple string headers.
  headers?: Record<string, string>;
}

// Central fetch wrapper: every request goes through here, so token handling
// and error parsing live in ONE place. Handles 401s (invalid/expired token)
// by clearing localStorage and redirecting to /login.
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  // Attach the access token if one exists. The value is a JWT string
  // stored in localStorage after login.
  const token = localStorage.getItem('accessToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  // Parse the JSON regardless of status so callers can inspect error bodies.
  const data = await res.json();

  // 401 anywhere in the app = token is dead → clear state, land on /login.
  if (res.status === 401) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    // server errors arrive as { message: string | string[], statusCode }
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }

  return data as T;
}