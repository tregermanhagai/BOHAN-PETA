/**
 * Minimal fetch wrapper. Defaults the API host to whatever hostname the
 * page itself was loaded from (localhost, or the PC's LAN IP when opened
 * from the Samsung S24 FE over Wi-Fi) so no per-device config is needed —
 * only the port differs between the web dev server and the API.
 */
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:3000`;

const TOKEN_KEY = "bohan-peta-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<TResponse>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<TResponse> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }

  if (res.status === 204) return undefined as TResponse;
  return (await res.json()) as TResponse;
}

/**
 * Downloads a file from an authenticated endpoint. A plain <a href> can't
 * carry the Authorization header, so this fetches the bytes as a blob and
 * triggers the browser's save dialog via a throwaway object URL instead.
 */
export async function downloadAuthenticated(path: string, fallbackFilename: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = utf8Match
    ? decodeURIComponent(utf8Match[1])
    : (plainMatch?.[1] ?? fallbackFilename);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, opts?: { auth?: boolean }) => request<T>(path, { auth: opts?.auth ?? true }),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "POST", body, auth: opts?.auth ?? true }),
  put: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PUT", body, auth: opts?.auth ?? true }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
