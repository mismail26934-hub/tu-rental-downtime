import { enqueueMutation } from "@/lib/offline/outbox";
import type { OutboxMethod } from "@/lib/offline/outbox";

export type MutationResult<T> = {
  queued: boolean;
  data?: T;
};

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /failed to fetch|network|load failed/i.test(error.message);
}

export async function sendMutation<T>(options: {
  method: OutboxMethod;
  url: string;
  body?: unknown;
  rowId: string;
}): Promise<MutationResult<T>> {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline) {
    await enqueueMutation(options);
    return { queued: true };
  }

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      let message = `Permintaan gagal (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const data = (await response.json()) as T;
    return { queued: false, data };
  } catch (error) {
    if (isNetworkError(error)) {
      await enqueueMutation(options);
      return { queued: true };
    }
    throw error;
  }
}
