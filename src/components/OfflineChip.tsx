"use client";

import { useSyncExternalStore } from "react";
import {
  flushOutbox,
  getOutboxSnapshot,
  getServerOutboxSnapshot,
  subscribeOutbox,
} from "@/lib/offline/outbox";

export function OfflineChip() {
  const status = useSyncExternalStore(
    subscribeOutbox,
    getOutboxSnapshot,
    getServerOutboxSnapshot
  );
  const online = useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true
  );

  let label = "Online";
  let tone = "online";
  if (status.syncing) {
    label = "Menyinkronkan…";
    tone = "sync";
  } else if (!online && status.pending > 0) {
    label = `Offline · ${status.pending} menunggu`;
    tone = "offline";
  } else if (!online) {
    label = "Offline";
    tone = "offline";
  } else if (status.error) {
    label = "Gagal sinkron";
    tone = "error";
  } else if (status.pending > 0) {
    label = `${status.pending} menunggu`;
    tone = "offline";
  }

  if (tone === "online") return null;

  return (
    <button
      className={`offline-sync-chip offline-sync-chip--${tone}`}
      type="button"
      title={status.error || "Ketuk untuk mengirim data yang tersimpan di perangkat"}
      onClick={() => {
        void flushOutbox();
      }}
    >
      <span className="offline-sync-dot" />
      {label}
    </button>
  );
}
