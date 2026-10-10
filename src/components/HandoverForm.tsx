"use client";

import { useEffect, useRef, useState } from "react";
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
          Crew
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
          Waiting Labour
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
        <button className="btn btn-primary" type="submit" disabled={!ready || busy || !value.unit.trim()}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
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
  const timeRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatDateTimeDMY(value));
  const [focused, setFocused] = useState(false);
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  const datePart = parts?.[1] || "";
  const timePart = parts?.[2] || "";

  useEffect(() => {
    if (!focused) setText(formatDateTimeDMY(value));
  }, [focused, value]);

  function commitParts(date: string, time: string) {
    if (!date && !time) {
      onChange("");
      setText("");
      return;
    }
    const iso = `${date || todayISO()}T${time || "00:00"}`;
    onChange(iso);
    setText(formatDateTimeDMY(iso));
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
          className="picker-btn"
          type="button"
          aria-label="Pilih jam"
          disabled={disabled}
          onClick={() => openPicker(timeRef.current)}
        >
          <ClockIcon />
        </button>
        <input
          ref={timeRef}
          className="picker-proxy"
          type="time"
          step={60}
          tabIndex={-1}
          value={timePart}
          disabled={disabled}
          aria-hidden="true"
          onChange={(event) => commitParts(datePart, event.target.value.slice(0, 5))}
        />
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
