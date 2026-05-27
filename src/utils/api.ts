import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

export const BASE_URL = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php";
export const API_BASE = `${BASE_URL}/API_main`;

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  if (Capacitor.isNativePlatform()) {
    let data: any = undefined;
    if (opts?.body) {
      try { data = JSON.parse(opts.body as string); } catch { data = opts.body; }
    }
    const response = await CapacitorHttp.request({
      url,
      method: opts?.method || "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(opts?.headers as Record<string, string> ?? {}),
      },
      data,
    });
    if (response.status >= 400) {
      throw new Error(response.data?.message ?? "Request failed");
    }
    return response.data as T;
  }

  // Browser — regular fetch
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}