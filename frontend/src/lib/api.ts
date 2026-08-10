const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export class ApiErrorImpl extends Error implements ApiError {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(path: string): string {
  return `${BASE}/api${path}`;
}

let token: string | null = null;
export function setToken(t: string | null): void {
  token = t;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { ...options, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiErrorImpl(res.status, err?.code ?? 'ERROR', err?.message ?? `Erreur HTTP ${res.status}`);
  }
  return body as T;
}

export async function uploadForm(path: string, form: FormData): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { method: 'POST', body: form, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiErrorImpl(res.status, err?.code ?? 'ERROR', err?.message ?? `Erreur HTTP ${res.status}`);
  }
  return body;
}
