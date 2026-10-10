import type { QueryClient } from "@tanstack/react-query";
import { flushOutbox, hasPendingSync, onQueueDrained } from "@/lib/offline/outbox";

let queryClient: QueryClient | null = null;
let started = false;

export function bindQueryClient(client: QueryClient) {
  queryClient = client;
}

export function shouldHoldServerRefresh(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return hasPendingSync();
}

export function startOutboxSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onQueueDrained(() => {
    if (shouldHoldServerRefresh()) return;
    void queryClient?.invalidateQueries({ queryKey: ["board"] });
  });
  const kick = () => {
    void flushOutbox();
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  kick();
}
