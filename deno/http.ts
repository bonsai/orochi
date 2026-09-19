export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api(
  base: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined
      ? { "content-type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text);
  return text ? JSON.parse(text) : null;
}