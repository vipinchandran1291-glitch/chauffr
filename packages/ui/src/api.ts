import type { AppName } from '@chauffr/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Api = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

export function createApi(app: AppName): Api {
  return async (method, path, body) => {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-chauffr-app': app },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
    return data;
  };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');
