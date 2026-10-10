"use client";

import { useSummaryView } from "@/lib/summary-view";

export function SummaryUnitToggle() {
  const unit = useSummaryView((state) => state.unit);
  const setUnit = useSummaryView((state) => state.setUnit);
  return (
    <div className="summary-unit" role="group" aria-label="Satuan waktu">
      <button className={unit === "jam" ? "btn btn-primary" : "btn"} type="button" aria-pressed={unit === "jam"} onClick={() => setUnit("jam")}>
        <ClockIcon />
        <span className="btn-label">Jam</span>
      </button>
      <button className={unit === "hari" ? "btn btn-primary" : "btn"} type="button" aria-pressed={unit === "hari"} onClick={() => setUnit("hari")}>
        <CalendarIcon />
        <span className="btn-label">Hari</span>
      </button>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}
