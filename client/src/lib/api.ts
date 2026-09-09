const API = import.meta.env.VITE_API_BASE_URL || '/api';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data as T;
}

export async function upload(file: File): Promise<{url: string}> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/uploads`, { method: 'POST', credentials: 'include', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}
