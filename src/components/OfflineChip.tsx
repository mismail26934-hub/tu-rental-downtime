"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
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

const MOBILE_MQ = "(max-width: 767px)";

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

function useMobileSheet() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

type Props = {
  onRefresh?: () => void;
  refreshBusy?: boolean;
};

export function OfflineChip({ onRefresh, refreshBusy = false }: Props) {
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
  const isMobile = useMobileSheet();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    let cancel = false;
    const load = () => {
      void listOutbox().then((next) => {
        if (!cancel) setItems(next);
      });
    };
    load();
    const unsub = subscribeOutbox(load);
    return () => {
      cancel = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !isMobile) return;
    document.documentElement.classList.add("offline-sheet-open");
    return () => document.documentElement.classList.remove("offline-sheet-open");
  }, [open, isMobile]);

  const visible = !online || status.pending > 0 || Boolean(status.error) || status.syncing;

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  let label = "Online";
  let tone = "online";
  let detail = "";
  let panelTitle = "Menunggu sinkron";
  if (status.syncing) {
    label = "Menyinkronkan…";
    tone = "sync";
    detail = status.pending > 0 ? `Mengirim ${status.pending} perubahan…` : "Menyinkronkan…";
    panelTitle = "Sinkronisasi";
  } else if (!online && status.pending > 0) {
    label = `Offline · ${status.pending}`;
    tone = "offline";
    detail = `${status.pending} perubahan menunggu. Akan dikirim setelah tersambung.`;
    panelTitle = "Offline";
  } else if (!online) {
    label = "Offline";
    tone = "offline";
    detail = "Perangkat offline. Data dikirim setelah tersambung.";
    panelTitle = "Offline";
  } else if (status.error) {
    label = "Gagal sinkron";
    tone = "error";
    detail = status.error;
    panelTitle = "Gagal sinkron";
  } else if (status.pending > 0) {
    label = `${status.pending} menunggu`;
    tone = "sync";
    detail = `${status.pending} perubahan menunggu dikirim.`;
    panelTitle = "Menunggu sinkron";
  }

  if (!visible) return null;

  const canSend = online && !status.syncing && status.pending > 0;

  const panelBody = (
    <>
      <div className="offline-sync-panel-head">
        <p className="offline-sync-pop-title" id={titleId}>
          {panelTitle}
        </p>
        <button
          type="button"
          className="btn btn-icon offline-sync-sheet-close"
          aria-label="Tutup"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>
      <p className="offline-sync-pop-body">{detail}</p>
      {items.length > 0 ? (
        <>
          <p className="offline-sync-changes-label">Perubahan menunggu</p>
          <ul className="offline-sync-changes">
            {items.map((item) => {
              const unit = rowText(item.body, "unit");
              const crew = rowText(item.body, "crew");
              const detailLine = [unit, crew ? `Crew ${crew}` : ""].filter(Boolean).join(" · ");
              return (
                <li className="offline-sync-change" key={item.id}>
                  <p className="offline-sync-change-title">
                    {ACTION[item.method]}
                    {detailLine ? ` · ${detailLine}` : " · Baris handover"}
                  </p>
                  <p className="offline-sync-change-meta">{queuedAt(item.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <div className={`offline-sync-pop-actions${isMobile ? " offline-sync-pop-actions--stack" : ""}`}>
        {!online ? (
          <p className="offline-sync-pop-status" role="status">
            {status.pending > 0
              ? `${status.pending} perubahan menunggu koneksi.`
              : "Menunggu koneksi."}
          </p>
        ) : (
          <>
            <button
              className="btn btn-primary offline-sync-btn"
              type="button"
              disabled={!canSend}
              onClick={() => void flushOutbox()}
            >
              {status.syncing ? "Mengirim…" : "Kirim sekarang"}
            </button>
            {onRefresh ? (
              <button
                className="btn offline-sync-btn"
                type="button"
                disabled={refreshBusy}
                onClick={() => {
                  onRefresh();
                  setOpen(false);
                }}
              >
                Muat ulang
              </button>
            ) : null}
          </>
        )}
        {isMobile ? (
          <button className="btn offline-sync-btn" type="button" onClick={() => setOpen(false)}>
            Tutup
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className={`offline-sync${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        className={`offline-sync-chip offline-sync-chip--${tone}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        title={detail}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="offline-sync-dot" aria-hidden="true" />
        {label}
      </button>
      {open && !isMobile ? (
        <div className="offline-sync-pop" role="dialog" aria-labelledby={titleId}>
          {panelBody}
        </div>
      ) : null}
      {open && isMobile
        ? createPortal(
            <div className="offline-sync-sheet-backdrop" onClick={() => setOpen(false)}>
              <div
                className="offline-sync-sheet"
                role="dialog"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                {panelBody}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
