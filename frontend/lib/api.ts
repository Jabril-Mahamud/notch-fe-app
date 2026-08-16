export type Feature = {
  id: number;
  title: string;
  body: string;
  author: string;
  votes: number;
  voted: boolean;
  created_at: string;
};

const TOKEN_KEY = "notch_token";
const USER_KEY = "notch_user";

export const session = {
  token: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  user: () => (typeof window === "undefined" ? null : localStorage.getItem(USER_KEY)),
  save(token: string, username: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/** Same-origin /api in both environments: the ingress routes it in the cluster,
 * a Next rewrite proxies it under Compose. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session.token();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? detail?.error ?? `request failed (${res.status})`);
  }
  return res.json();
}
