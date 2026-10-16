const TOKEN_KEY = 'ailian_admin_token';
export const session = { get: () => localStorage.getItem(TOKEN_KEY), set: (value: string) => localStorage.setItem(TOKEN_KEY, value), clear: () => localStorage.removeItem(TOKEN_KEY) };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(session.get() ? { Authorization: `Bearer ${session.get()}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') session.clear();
    throw new Error(body?.error?.message || '请求失败，请稍后重试');
  }
  return body as T;
}
