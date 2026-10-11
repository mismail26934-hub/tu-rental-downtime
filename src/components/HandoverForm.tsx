"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeMetrics, deriveStatus } from "@/lib/calc";
import { formatDateTimeDMY, formatDt, formatHours, parseDateTimeDMY, todayISO } from "@/lib/format";
import { hmLiveError } from "@/lib/row-input";
import { UnitSelect } from "@/components/UnitSelect";
import type { Metrics, RowInput } from "@/lib/types";

type Props = {
  value: RowInput;
  now: Date;
  mode: "create" | "edit";
  busy: boolean;
  ready: boolean;
  notice: string;
  error: string;
  unchanged?: boolean;
  onChange: (next: RowInput) => void;
  onHmCheck: (message: string | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDiscardDraft: () => void;
};

export function HandoverForm({
  value,
  now,
  mode,
  busy,
  ready,
  notice,
  error,
  unchanged = false,
  onChange,
  onHmCheck,
  onSubmit,
  onCancel,
  onDiscardDraft,
}: Props) {
  const metrics: Metrics = computeMetrics(value, now);
  const hmMessage = error.startsWith("HM ") ? error : "";

  function setField<K extends keyof RowInput>(key: K, next: string) {
    const row = { ...value, [key]: next };
    onChange({ ...row, status: deriveStatus(row) });
    if (key === "hm_awal" || key === "hm_akhir") onHmCheck(hmLiveError(row, true));
  }

  function blurHm(key: "hm_awal" | "hm_akhir", next: string) {
    onHmCheck(hmLiveError({ ...value, [key]: next }));
  }

  return (
    <form
      className="form"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="panel-head">
        <h2 id="unit-form-title">{mode === "edit" ? "Ubah unit" : "Tambah unit"}</h2>
        <button className="btn btn-sm" type="button" onClick={onDiscardDraft}>
          Buang draft
        </button>
      </div>
      <div className="form-grid">
        <label>
          <span>
            Crew <abbr className="req" title="Wajib diisi">*</abbr>
          </span>
          <input
            value={value.crew}
            disabled={!ready || busy}
            onChange={(event) => setField("crew", event.target.value)}
          />
        </label>
        <label>
          <span>
            Unit <abbr className="req" title="Wajib diisi">*</abbr>
          </span>
          <UnitSelect
            value={value.unit}
            disabled={!ready || busy}
            onChange={(unit) => setField("unit", unit)}
          />
        </label>
        <label>
          Location
          <input
            value={value.location}
            disabled={!ready || busy}
            onChange={(event) => setField("location", event.target.value)}
          />
        </label>
        <label>
          Technician
          <input
            value={value.technician}
            disabled={!ready || busy}
            onChange={(event) => setField("technician", event.target.value)}
          />
        </label>
        <label>
          Status
          <input value={deriveStatus(value)} readOnly tabIndex={-1} />
        </label>
        <label>
          <span>
            Waiting Labour <abbr className="req" title="Wajib diisi">*</abbr>
          </span>
          <DateTimeField
            value={value.waiting_labour_at}
            disabled={!ready || busy}
            onChange={(next) => setField("waiting_labour_at", next)}
          />
        </label>
        <label>
          Repair Time
          <DateTimeField
            value={value.repair_started_at}
            disabled={!ready || busy}
            onChange={(next) => setField("repair_started_at", next)}
          />
        </label>
        <label>
          RD30
          <DateTimeField
            value={value.rd30_at}
            disabled={!ready || busy}
            onChange={(next) => setField("rd30_at", next)}
          />
        </label>
        <label>
          HM awal
          <input
            inputMode="decimal"
            value={value.hm_awal}
            disabled={!ready || busy}
            aria-invalid={hmMessage === "HM awal harus angka" || hmMessage.startsWith("HM akhir tidak boleh")}
            onChange={(event) => setField("hm_awal", event.target.value)}
            onBlur={(event) => blurHm("hm_awal", event.target.value)}
          />
        </label>
        <label>
          HM akhir
          <input
            inputMode="decimal"
            value={value.hm_akhir}
            disabled={!ready || busy}
            aria-invalid={hmMessage === "HM akhir harus angka" || hmMessage.startsWith("HM akhir tidak boleh")}
            onChange={(event) => setField("hm_akhir", event.target.value)}
            onBlur={(event) => blurHm("hm_akhir", event.target.value)}
          />
        </label>
        {hmMessage ? <div className="error form-span">{hmMessage}</div> : null}
        <label className="form-span">
          Breakdown problem
          <textarea
            rows={3}
            value={value.breakdown_problem}
            disabled={!ready || busy}
            onChange={(event) => setField("breakdown_problem", event.target.value)}
          />
        </label>
        <label className="form-span">
          Done / Action
          <textarea
            rows={3}
            value={value.done_action}
            disabled={!ready || busy}
            onChange={(event) => setField("done_action", event.target.value)}
          />
        </label>
        <label className="form-span">
          Continue / Handover job
          <textarea
            rows={2}
            value={value.continue_handover}
            disabled={!ready || busy}
            onChange={(event) => setField("continue_handover", event.target.value)}
          />
        </label>
        <label className="form-span">
          SO
          <textarea
            rows={2}
            value={value.so}
            disabled={!ready || busy}
            onChange={(event) => setField("so", event.target.value)}
          />
        </label>
      </div>
      <div className="metric-row" aria-live="polite">
        <div className="metric">
          <div className="label">ERDM</div>
          <div className="value">{formatHours(metrics.erdm)}</div>
        </div>
        <div className="metric">
          <div className="label">Waiting</div>
          <div className="value">{formatHours(metrics.waitingLabourHours)}</div>
        </div>
        <div className="metric">
          <div className="label">Repair</div>
          <div className="value">{formatHours(metrics.repairHours)}</div>
        </div>
        <div className="metric">
          <div className="label">DT Total</div>
          <div className="value">{formatDt(metrics.dtLabel, metrics.dtTotal)}</div>
        </div>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {error && !hmMessage ? <div className="error">{error}</div> : null}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={!ready || busy || !value.crew.trim() || !value.unit.trim() || !value.waiting_labour_at.trim() || unchanged}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}

function nowClock(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function DateTimeField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const timePanelRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => formatDateTimeDMY(value));
  const [focused, setFocused] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timePos, setTimePos] = useState({ top: 0, left: 0 });
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  const datePart = parts?.[1] || "";
  const timePart = parts?.[2] || "";
  const shownTime = timePart || nowClock();
  const [shownHour, shownMinute] = shownTime.split(":");

  useEffect(() => {
    if (!focused) setText(formatDateTimeDMY(value));
  }, [focused, value]);

  useEffect(() => {
    if (!timeOpen) return;
    const panel = timePanelRef.current;
    panel?.querySelectorAll<HTMLElement>(".time-col").forEach((col) => {
      const selected = col.querySelector<HTMLElement>(".is-on");
      if (!selected) return;
      col.scrollTop = selected.offsetTop - col.clientHeight / 2 + selected.clientHeight / 2;
    });
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setTimeOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (panel?.contains(target) || timeButtonRef.current?.contains(target)) return;
      setTimeOpen(false);
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [timeOpen]);

  function commitParts(date: string, time: string) {
    if (!date && !time) {
      onChange("");
      setText("");
      return;
    }
    const iso = `${date || todayISO()}T${time || nowClock()}`;
    onChange(iso);
    setText(formatDateTimeDMY(iso));
  }

  function openTime() {
    if (disabled) return;
    if (timeOpen) {
      setTimeOpen(false);
      return;
    }
    if (!timePart) commitParts(datePart, nowClock());
    const rect = timeButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 148;
      const height = 240;
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : below;
      setTimePos({ top, left });
    }
    setTimeOpen(true);
  }

  function openPicker(input: HTMLInputElement | null) {
    if (!input || disabled) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <div className="datetime-field">
      <input
        inputMode="numeric"
        placeholder="dd/mm/yyyy hh:mm"
        title="dd/mm/yyyy hh:mm"
        value={text}
        disabled={disabled}
        onFocus={() => {
          setFocused(true);
          setText(formatDateTimeDMY(value));
        }}
        onBlur={() => {
          setFocused(false);
          if (!text.trim()) {
            onChange("");
            setText("");
            return;
          }
          const parsed = parseDateTimeDMY(text);
          if (parsed) {
            onChange(parsed);
            setText(formatDateTimeDMY(parsed));
            return;
          }
          setText(formatDateTimeDMY(value));
        }}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next.trim()) {
            onChange("");
            return;
          }
          const parsed = parseDateTimeDMY(next);
          if (parsed) onChange(parsed);
        }}
      />
      <span className="picker-slot">
        <button
          className="picker-btn"
          type="button"
          aria-label="Pilih tanggal"
          disabled={disabled}
          onClick={() => openPicker(dateRef.current)}
        >
          <CalendarIcon />
        </button>
        <input
          ref={dateRef}
          className="picker-proxy"
          type="date"
          tabIndex={-1}
          value={datePart}
          disabled={disabled}
          aria-hidden="true"
          onChange={(event) => commitParts(event.target.value, timePart)}
        />
      </span>
      <span className="picker-slot">
        <button
          ref={timeButtonRef}
          className="picker-btn"
          type="button"
          aria-label="Pilih jam"
          aria-expanded={timeOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={openTime}
        >
          <ClockIcon />
        </button>
        {timeOpen
          ? createPortal(
              <div
                ref={timePanelRef}
                className="time-panel"
                style={{ top: timePos.top, left: timePos.left }}
              >
                <div className="time-col" role="listbox" aria-label="Jam">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const label = String(hour).padStart(2, "0");
                    return (
                      <button
                        key={label}
                        className={label === shownHour ? "is-on" : undefined}
                        type="button"
                        role="option"
                        aria-selected={label === shownHour}
                        onClick={() => commitParts(datePart, `${label}:${shownMinute}`)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="time-col" role="listbox" aria-label="Menit">
                  {Array.from({ length: 60 }, (_, minute) => {
                    const label = String(minute).padStart(2, "0");
                    return (
                      <button
                        key={label}
                        className={label === shownMinute ? "is-on" : undefined}
                        type="button"
                        role="option"
                        aria-selected={label === shownMinute}
                        onClick={() => commitParts(datePart, `${shownHour}:${label}`)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body,
            )
          : null}
      </span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}
