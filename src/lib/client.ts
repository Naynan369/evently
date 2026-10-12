export async function api<T = Record<string, unknown>>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/" + path, {
      method: options?.method || "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body:
        options?.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      "We couldn’t reach Evently. Check your connection and try again.",
    );
  }
  const value = await response.json().catch(() => null);
  if (!value)
    throw new Error(
      "Evently could not complete this request. Please refresh the page and try again.",
    );
  if (!response.ok)
    throw new Error(value.error || "Something went wrong. Please try again.");
  return value as T;
}
