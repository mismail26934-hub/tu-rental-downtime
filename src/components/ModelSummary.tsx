"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CARD_FIELDS, CARD_FIELD_LABEL, useModelCardFields, type CardFieldState } from "@/lib/model-card-fields";
import { presentModelCards, type ModelSummaryUnit } from "@/lib/model-cards";
import type { SummaryReport } from "@/lib/summary";
import type { SummaryUnit } from "@/lib/summary-view";
import { useWaScheduleView } from "@/lib/wa-schedule-view";

export type { ModelSummaryUnit };

export function ModelSummary({
  units,
  report,
  ready,
  asOf,
  mode,
  hidden,
  onToggle,
  allowWhatsapp = false,
  allowSchedule = false,
  year = "",
}: {
  units: ModelSummaryUnit[];
  report?: SummaryReport;
  ready: boolean;
  asOf: string;
  mode: SummaryUnit;
  hidden: boolean;
  onToggle: () => void;
  allowWhatsapp?: boolean;
  allowSchedule?: boolean;
  year?: string;
}) {
  const stored = useModelCardFields();
  const fields = useMemo(() => cardFields(stored), [stored]);
  const cards = useMemo(
    () => presentModelCards({ units, report, ready, asOf, mode, fields }),
    [units, report, ready, asOf, mode, fields]
  );
  if (cards.length === 0) return null;
  return (
    <CollapseBoard
      hidden={hidden}
      label="Summary by Model"
      hiddenLabel="Summary by Model disembunyikan"
      onToggle={onToggle}
      fields
      whatsapp={allowWhatsapp ? { year, mode, fields, schedule: allowSchedule } : undefined}
    >
      <div className="model-cards">
        {cards.map((card) => (
          <article key={card.key} className={`model-card is-${card.tone}`} aria-label={`Sisa ${card.label}`}>
            <div className="model-card-head">
              <span className="model-card-mark" aria-hidden="true">{card.mark}</span>
              <div className="model-card-title">
                <div className="label">{card.label}</div>
                <div className="model-card-count">{card.countLabel}</div>
              </div>
            </div>
            {card.units.length > 0 ? (
              <div className="model-card-units">
                {card.units.map((unit, index) => (
                  <span key={`${unit.code}-${index}`}>
                    {index > 0 ? ", " : null}
                    <span className={unit.tone === "open" ? "is-ny" : unit.tone === "backup" ? "is-backup" : undefined}>{unit.code}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {card.dailyValue || card.meta ? (
              <div className="model-card-hero">
                {card.dailyValue ? (
                  <>
                    <div className="label">Sisa Daily</div>
                    <div className="value">{card.dailyValue}</div>
                  </>
                ) : null}
                {card.meta ? <div className="model-card-meta">{card.meta}</div> : null}
              </div>
            ) : null}
            {card.periods.length > 0 ? (
              <ul className="model-card-periods">
                {card.periods.map((period) => (
                  <li key={period.label}>
                    <span>{period.label}</span>
                    <strong className={period.minus ? "is-minus" : undefined}>{period.value}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </CollapseBoard>
  );
}

function cardFields(state: CardFieldState): CardFieldState {
  return {
    units: state.units,
    daily: state.daily,
    quota: state.quota,
    jam: state.jam,
    wtd: state.wtd,
    mtd: state.mtd,
    hytd1: state.hytd1,
    hytd2: state.hytd2,
    ytd: state.ytd,
  };
}

export function CollapseBoard({
  hidden,
  label,
  hiddenLabel,
  onToggle,
  fields = false,
  ariaLabel,
  whatsapp,
  children,
}: {
  hidden: boolean;
  label: ReactNode;
  hiddenLabel: ReactNode;
  onToggle: () => void;
  fields?: boolean;
  ariaLabel?: string;
  whatsapp?: { year: string; mode: SummaryUnit; fields: CardFieldState; schedule?: boolean };
  children: ReactNode;
}) {
  const spoken = ariaLabel || (typeof label === "string" ? label : "");
  return (
    <section className={`collapse-board${hidden ? " is-hidden" : ""}`}>
      <div className="collapse-board-bar">
        <span>{hidden ? hiddenLabel : label}</span>
        <div className="collapse-board-actions">
          {whatsapp ? <SendWhatsappButton year={whatsapp.year} mode={whatsapp.mode} fields={whatsapp.fields} /> : null}
          {whatsapp?.schedule ? <ScheduleWhatsappButton year={whatsapp.year} mode={whatsapp.mode} fields={whatsapp.fields} /> : null}
          {fields ? <CardFieldSettings /> : null}
          <button
            className="btn btn-icon"
            type="button"
            onClick={onToggle}
            aria-expanded={!hidden}
            aria-label={hidden ? `Tampilkan ${spoken}` : `Sembunyikan ${spoken}`}
            title={hidden ? "Tampilkan" : "Sembunyikan"}
          >
            <ChevronIcon up={!hidden} />
          </button>
        </div>
      </div>
      {hidden ? null : children}
    </section>
  );
}

function CardFieldSettings() {
  const fields = useModelCardFields();
  const setField = useModelCardFields((state) => state.setField);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div className="summary-settings" ref={rootRef}>
      <button className="btn btn-icon" type="button" aria-label="Data kartu" aria-expanded={open} title="Data kartu" onClick={() => setOpen((value) => !value)}>
        <SettingsIcon />
      </button>
      {open ? (
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="summary-settings-menu" role="group" aria-label="Data kartu">
            <p className="sheet-title">Data kartu</p>
            {CARD_FIELDS.map((field) => (
              <label key={field}>
                <input
                  type="checkbox"
                  checked={fields[field]}
                  onChange={(event) => setField(field, event.target.checked)}
                />
                {CARD_FIELD_LABEL[field]}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SendWhatsappButton({ year, mode, fields }: { year: string; mode: SummaryUnit; fields: CardFieldState }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    if (!confirm) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setConfirm(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirm, busy]);

  function closeConfirm() {
    if (busy) return;
    setConfirm(false);
  }

  async function send() {
    setBusy(true);
    setNote("");
    setFailed(false);
    setModalError("");
    try {
      const response = await fetch("/api/whatsapp/model-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, mode, fields }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal mengirim");
      setConfirm(false);
      setNote("Terkirim ke WhatsApp.");
    } catch (error) {
      setFailed(true);
      setModalError(error instanceof Error ? error.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="summary-settings">
        <button className="btn btn-icon" type="button" aria-label="Kirim ke WhatsApp" title="Kirim ke WhatsApp" disabled={busy} onClick={() => { setModalError(""); setConfirm(true); }}>
          <WhatsappIcon />
        </button>
        {note ? <div className={`summary-send-note${failed ? " is-error" : ""}`} role="status">{note}</div> : null}
      </div>
      {confirm ? (
        <div className="form-modal-backdrop alert-backdrop" onMouseDown={closeConfirm}>
          <div
            className="form-modal alert-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wa-send-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="wa-send-title">Kirim ke WhatsApp?</h2>
            <p>Summary by Model akan dikirim ke grup.</p>
            {modalError ? <p className="error">{modalError}</p> : null}
            <div className="form-actions">
              <button className="btn btn-primary" type="button" onClick={() => void send()} disabled={busy}>
                {busy ? "Mengirim…" : "Kirim"}
              </button>
              <button className="btn" type="button" onClick={closeConfirm} disabled={busy}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const INTERVALS: [number, string][] = [
  [30, "30 menit"],
  [60, "1 jam"],
  [120, "2 jam"],
  [180, "3 jam"],
  [360, "6 jam"],
  [720, "12 jam"],
];

type SchedulePayload = {
  enabled: boolean;
  intervalMinutes: number;
  activeFrom: string;
  activeUntil: string;
  nextRunAt: string;
  lastRunAt: string;
  lastError: string;
};

function ScheduleWhatsappButton({ year, mode, fields }: { year: string; mode: SummaryUnit; fields: CardFieldState }) {
  const storedEnabled = useWaScheduleView((state) => state.enabled);
  const storedInterval = useWaScheduleView((state) => state.intervalMinutes);
  const storedFrom = useWaScheduleView((state) => state.activeFrom);
  const storedUntil = useWaScheduleView((state) => state.activeUntil);
  const setSchedule = useWaScheduleView((state) => state.setSchedule);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(storedEnabled);
  const [intervalMinutes, setIntervalMinutes] = useState(storedInterval);
  const [activeFrom, setActiveFrom] = useState(storedFrom);
  const [activeUntil, setActiveUntil] = useState(storedUntil);
  const [nextRunAt, setNextRunAt] = useState("");
  const [lastError, setLastError] = useState("");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEnabled(storedEnabled);
    setIntervalMinutes(storedInterval);
    setActiveFrom(storedFrom);
    setActiveUntil(storedUntil);
  }, [storedEnabled, storedInterval, storedFrom, storedUntil]);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/whatsapp/schedule", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as SchedulePayload;
        if (cancel) return;
        setNextRunAt(body.nextRunAt || "");
        setLastError(body.lastError || "");
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  async function save() {
    setBusy(true);
    setNote("");
    setFailed(false);
    try {
      const response = await fetch("/api/whatsapp/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalMinutes, activeFrom, activeUntil, year, mode, fields }),
      });
      const body = (await response.json().catch(() => null)) as (SchedulePayload & { error?: string }) | null;
      if (!response.ok || !body || body.error) throw new Error(body?.error || "Gagal menyimpan jadwal");
      setSchedule({
        enabled: body.enabled,
        intervalMinutes: body.intervalMinutes || 60,
        activeFrom: body.activeFrom || "06:00",
        activeUntil: body.activeUntil || "22:00",
      });
      setNextRunAt(body.nextRunAt || "");
      setLastError(body.lastError || "");
      setNote(body.enabled ? "Jadwal aktif." : "Jadwal dimatikan.");
    } catch (error) {
      setFailed(true);
      setNote(error instanceof Error ? error.message : "Gagal menyimpan jadwal");
    } finally {
      setBusy(false);
    }
  }

  const choices = INTERVALS.some(([value]) => value === intervalMinutes) ? INTERVALS : [[intervalMinutes, `${intervalMinutes} menit`] as [number, string], ...INTERVALS];
  const nextLabel = formatRun(nextRunAt);

  return (
    <div className="summary-settings" ref={rootRef}>
      <button
        className={`btn btn-icon${storedEnabled ? " is-on" : ""}`}
        type="button"
        aria-label="Jadwal WhatsApp"
        aria-expanded={open}
        title={storedEnabled ? "Kirim otomatis aktif" : "Kirim otomatis"}
        onClick={() => setOpen((value) => !value)}
      >
        <ClockIcon />
      </button>
      {open ? (
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="summary-settings-menu summary-schedule-menu" role="group" aria-label="Jadwal WhatsApp">
            <label>
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Kirim otomatis
            </label>
            <div className="summary-schedule-field">
              <span>Setiap</span>
              <select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))}>
                {choices.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="summary-schedule-row">
              <div className="summary-schedule-field">
                <span>Mulai</span>
                <input type="time" value={activeFrom} onChange={(event) => setActiveFrom(event.target.value)} />
              </div>
              <div className="summary-schedule-field">
                <span>Selesai</span>
                <input type="time" value={activeUntil} onChange={(event) => setActiveUntil(event.target.value)} />
              </div>
            </div>
            <p>Di luar jam ini pesan tidak dikirim. Memakai tahun, mode, dan data kartu yang sedang tampil.</p>
            {storedEnabled && nextLabel ? <p>Berikutnya {nextLabel}.</p> : null}
            {lastError ? <p className="is-error">{lastError}</p> : null}
            <button className="btn" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Menyimpan" : "Simpan"}</button>
            {note ? <p className={failed ? "is-error" : ""} role="status">{note}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatRun(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] || ""} ${match[1]}, ${match[4]}:${match[5]}`;
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11.5A8.5 8.5 0 0 1 7.3 18.9L4 20l1.2-3.2A8.5 8.5 0 1 1 20 11.5z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.46.54.8.6H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.4z" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {up ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}
