"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { formatStamp } from "@/lib/format";
import {
  flushOutbox,
  getOutboxSnapshot,
  getServerOutboxSnapshot,
  listOutbox,
  subscribeOutbox,
  type OutboxItem,
} from "@/lib/offline/outbox";

const ACTION: Record<OutboxItem["method"], string> = {
  POST: "Tambah",
  PATCH: "Ubah",
  DELETE: "Hapus",
};

function rowText(body: unknown, key: "unit" | "crew"): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const source =
    record.row && typeof record.row === "object"
      ? (record.row as Record<string, unknown>)
      : record;
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function queuedAt(value: number): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return formatStamp(stamp);
}

export function OfflineChip() {
  const status = useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getServerOutboxSnapshot);
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    void listOutbox().then((next) => {
      if (!cancel) setItems(next);
    });
    return () => {
      cancel = true;
    };
  }, [open, status.pending, status.syncing, status.error]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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

  const canSend = online && !status.syncing && status.pending > 0;

  return (
    <>
      <button
        className={`offline-sync-chip offline-sync-chip--${tone}`}
        type="button"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        title="Lihat data yang menunggu sinkronisasi"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="offline-sync-dot" />
        {label}
      </button>
      {open
        ? createPortal(
            <>
              <button className="sheet-backdrop offline-queue-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
              <div className="offline-queue-menu" role="dialog" aria-labelledby={titleId}>
                <div className="offline-queue-head">
                  <p className="offline-queue-title" id={titleId}>
                    Menunggu sinkron
                  </p>
                  <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
                    Tutup
                  </button>
                </div>
                {status.error ? <p className="error">{status.error}</p> : null}
                {!online ? <p className="offline-queue-note">Perangkat offline. Data dikirim setelah tersambung.</p> : null}
                {items.length === 0 ? (
                  <p className="offline-queue-empty">Tidak ada data menunggu.</p>
                ) : (
                  <ul className="offline-queue-list">
                    {items.map((item) => {
                      const unit = rowText(item.body, "unit");
                      const crew = rowText(item.body, "crew");
                      const detail = [unit, crew ? `Crew ${crew}` : ""].filter(Boolean).join(" · ");
                      return (
                        <li className="offline-queue-item" key={item.id}>
                          <span className="offline-queue-action">{ACTION[item.method]}</span>
                          <span>{detail || "Baris handover"}</span>
                          <time dateTime={new Date(item.createdAt).toISOString()}>{queuedAt(item.createdAt)}</time>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button className="btn btn-primary" type="button" disabled={!canSend} onClick={() => void flushOutbox()}>
                  {status.syncing ? "Mengirim…" : "Kirim sekarang"}
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
