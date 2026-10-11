import { get, set } from "idb-keyval";

const KEY = "tu-rental-outbox";

export type OutboxMethod = "POST" | "PATCH" | "DELETE";

export type OutboxItem = {
  id: string;
  method: OutboxMethod;
  url: string;
  body?: unknown;
  rowId: string;
  createdAt: number;
};

export type OutboxSnapshot = {
  pending: number;
  syncing: boolean;
  error: string;
};

const SERVER_SNAPSHOT: OutboxSnapshot = { pending: 0, syncing: false, error: "" };

let snapshot: OutboxSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let flushing = false;
let onDrained: () => void = () => undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

function replace(next: OutboxSnapshot) {
  snapshot = next;
  emit();
}

export function getOutboxSnapshot(): OutboxSnapshot {
  return snapshot;
}

export function getServerOutboxSnapshot(): OutboxSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onQueueDrained(listener: () => void) {
  onDrained = listener;
}

export function hasPendingSync(): boolean {
  return snapshot.pending > 0;
}

async function readItems(): Promise<OutboxItem[]> {
  const value = await get<OutboxItem[]>(KEY);
  return Array.isArray(value) ? value : [];
}

export function listOutbox(): Promise<OutboxItem[]> {
  return readItems();
}

async function writeItems(items: OutboxItem[]) {
  await set(KEY, items);
  replace({ ...snapshot, pending: items.length });
}

export async function hydrateOutbox(): Promise<void> {
  const read = readItems().then((items) => {
    replace({ ...snapshot, pending: items.length });
  });
  await Promise.race([
    read,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);
}

export async function enqueueMutation(item: Omit<OutboxItem, "id" | "createdAt">) {
  const items = await readItems();
  if (item.method === "DELETE") {
    const hadCreate = items.some((entry) => entry.method === "POST" && entry.rowId === item.rowId);
    const next = items.filter((entry) => entry.rowId !== item.rowId);
    if (!hadCreate) {
      next.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() });
    }
    await writeItems(next);
    return;
  }

  if (item.method === "PATCH") {
    const create = items.find((entry) => entry.method === "POST" && entry.rowId === item.rowId);
    if (create && create.body && typeof create.body === "object") {
      const body = create.body as { sheet?: unknown; row?: Record<string, unknown> };
      body.row = { ...(body.row || {}), ...(item.body as object), id: item.rowId };
      await writeItems(items);
      return;
    }
    const patchIndex = items.findIndex(
      (entry) => entry.method === "PATCH" && entry.rowId === item.rowId
    );
    if (patchIndex >= 0) {
      items[patchIndex] = {
        ...items[patchIndex],
        body: item.body,
        url: item.url,
      };
      await writeItems(items);
      return;
    }
  }

  items.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() });
  await writeItems(items);
}

async function sendItem(item: OutboxItem): Promise<"drop" | "stop"> {
  try {
    const response = await fetch(item.url, {
      method: item.method,
      headers: item.body ? { "content-type": "application/json" } : undefined,
      body: item.body ? JSON.stringify(item.body) : undefined,
    });
    if (response.ok || (item.method === "DELETE" && response.status === 404)) return "drop";
    if (response.status === 401) {
      replace({ ...snapshot, error: "Sesi berakhir. Masuk lagi untuk mengirim data." });
      return "stop";
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      replace({ ...snapshot, error: "Server belum siap. Data tetap di perangkat." });
      return "stop";
    }
    let message = "Sinkron gagal";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    replace({ ...snapshot, error: message });
    return "drop";
  } catch {
    replace({ ...snapshot, error: "Jaringan terputus. Data tetap di perangkat." });
    return "stop";
  }
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  replace({ ...snapshot, syncing: true, error: "" });
  let drained = false;
  try {
    for (;;) {
      const items = await readItems();
      replace({ ...snapshot, pending: items.length, syncing: true });
      if (!items.length) {
        drained = true;
        break;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      const outcome = await sendItem(items[0]);
      if (outcome === "stop") break;
      const current = await readItems();
      await writeItems(current.filter((entry) => entry.id !== items[0].id));
    }
  } finally {
    const items = await readItems().catch(() => []);
    replace({
      ...snapshot,
      pending: items.length,
      syncing: false,
    });
    flushing = false;
    if (drained) onDrained();
  }
}
