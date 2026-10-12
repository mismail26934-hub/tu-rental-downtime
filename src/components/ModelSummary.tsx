"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { formatHourClock, formatHours, formatQuotaDisplay } from "@/lib/format";
import { CARD_FIELDS, CARD_FIELD_LABEL, useModelCardFields } from "@/lib/model-card-fields";
import { PERIODS, periodQuota, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { toSummaryAmount, type SummaryUnit } from "@/lib/summary-view";

export type ModelSummaryUnit = {
  unit: string;
  model: string;
  quota_hrs: number | null;
};

const OTHER_PERIODS = PERIODS.filter((period) => period !== "daily");
const PERIOD_LABEL: Record<PeriodKey, string> = {
  daily: "Daily",
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

type Hours = Record<PeriodKey, number>;

type ModelCardModel = {
  key: string;
  label: string;
  quota: number | null;
  hours: Hours | null;
  units: { code: string; open: boolean; backedUp: boolean }[];
};

export function ModelSummary({
  units,
  report,
  ready,
  asOf,
  mode,
  hidden,
  onToggle,
}: {
  units: ModelSummaryUnit[];
  report?: SummaryReport;
  ready: boolean;
  asOf: string;
  mode: SummaryUnit;
  hidden: boolean;
  onToggle: () => void;
}) {
  const cards = useMemo(() => buildModelCards(units, report, ready), [units, report, ready]);
  const fields = useModelCardFields();
  if (cards.length === 0) return null;
  const now = asOfDate(asOf);
  const periods = OTHER_PERIODS.filter((period) => fields[period]);
  return (
    <CollapseBoard hidden={hidden} label="Summary by Model" hiddenLabel="Summary by Model disembunyikan" onToggle={onToggle} fields>
      <div className="model-cards">
        {cards.map((card) => {
          const dailyQuota = card.quota == null ? null : periodQuota(card.quota, "daily", now);
          const dailyJam = card.hours?.daily ?? null;
          const dailyLeft = dailyQuota == null || dailyJam == null ? null : round2(dailyQuota - dailyJam);
          const tone = sisaTone(dailyLeft, dailyQuota);
          const meta = cardMeta(card.quota, dailyQuota, dailyJam, mode, fields.quota, fields.jam);
          return (
            <article key={card.key} className={`model-card is-${tone}`} aria-label={`Sisa ${card.label}`}>
              <div className="model-card-head">
                <span className="model-card-mark" aria-hidden="true">{card.label.slice(0, 1).toUpperCase()}</span>
                <div className="model-card-title">
                  <div className="label">{card.label}</div>
                  <div className="model-card-count">{card.units.length} unit</div>
                </div>
              </div>
              {fields.units ? (
                <div className="model-card-units">
                  {card.units.map((unit, index) => (
                    <span key={unit.code}>
                      {index > 0 ? ", " : null}
                      <span className={unit.open ? "is-ny" : unit.backedUp ? "is-backup" : undefined}>
                        {unit.open ? `${unit.code}*` : unit.code}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              {fields.daily || meta ? (
                <div className="model-card-hero">
                  {fields.daily ? (
                    <>
                      <div className="label">Sisa Daily</div>
                      <div className="value">{formatCardAmount(dailyLeft, "daily", mode)}</div>
                    </>
                  ) : null}
                  {meta ? <div className="model-card-meta">{meta}</div> : null}
                </div>
              ) : null}
              {periods.length > 0 ? (
                <ul className="model-card-periods">
                  {periods.map((period) => {
                    const quota = card.quota == null || card.hours == null ? null : periodQuota(card.quota, period, now);
                    const jam = card.hours?.[period] ?? null;
                    const left = quota == null || jam == null ? null : round2(quota - jam);
                    return (
                      <li key={period}>
                        <span>{PERIOD_LABEL[period]}</span>
                        <strong className={left != null && left < 0 ? "is-minus" : undefined}>{formatCardAmount(left, period, mode)}</strong>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </CollapseBoard>
  );
}

export function CollapseBoard({
  hidden,
  label,
  hiddenLabel,
  onToggle,
  fields = false,
  children,
}: {
  hidden: boolean;
  label: string;
  hiddenLabel: string;
  onToggle: () => void;
  fields?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`collapse-board${hidden ? " is-hidden" : ""}`}>
      <div className="collapse-board-bar">
        <span>{hidden ? hiddenLabel : label}</span>
        <div className="collapse-board-actions">
          {fields ? <CardFieldSettings /> : null}
          <button
            className="btn btn-icon"
            type="button"
            onClick={onToggle}
            aria-expanded={!hidden}
            aria-label={hidden ? `Tampilkan ${label.toLowerCase()}` : `Sembunyikan ${label.toLowerCase()}`}
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

function cardMeta(
  sharedQuota: number | null,
  dailyQuota: number | null,
  dailyJam: number | null,
  mode: SummaryUnit,
  showQuota: boolean,
  showJam: boolean
): string {
  if (sharedQuota == null) return showQuota || showJam ? "Quota berbeda" : "";
  const parts: string[] = [];
  if (showQuota) parts.push(`Quota ${formatCardQuota(dailyQuota, mode)}`);
  if (showJam) parts.push(`Jam ${formatCardAmount(dailyJam, "daily", mode)}`);
  return parts.join(" · ");
}

function buildModelCards(units: ModelSummaryUnit[], report: SummaryReport | undefined, ready: boolean): ModelCardModel[] {
  const order: string[] = [];
  const buckets = new Map<string, ModelSummaryUnit[]>();
  for (const unit of units) {
    const key = unit.model.trim().toLowerCase();
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key)?.push(unit);
  }
  const byCode = new Map((report?.units || []).map((row) => [row.unit.trim().toLowerCase(), row]));
  return order.map((key) => {
    const members = buckets.get(key) || [];
    const firstQuota = members[0]?.quota_hrs ?? null;
    const shared = members.every((member) => member.quota_hrs === firstQuota) ? firstQuota : null;
    let hours: Hours | null = null;
    if (ready) {
      hours = emptyHours();
      for (const member of members) {
        const picked = pickHours(byCode.get(member.unit.trim().toLowerCase()));
        for (const period of PERIODS) hours[period] = round2(hours[period] + (picked?.[period] ?? 0));
      }
    }
    return {
      key,
      label: members[0]?.model || "—",
      quota: shared,
      hours,
      units: members.map((member) => {
        const row = byCode.get(member.unit.trim().toLowerCase());
        return { code: member.unit, open: Boolean(row?.open), backedUp: Boolean(row?.backedUp && !row?.open) };
      }),
    };
  });
}

function pickHours(row: SummaryRow | undefined): Hours | null {
  if (!row) return null;
  return { daily: row.daily, wtd: row.wtd, mtd: row.mtd, hytd1: row.hytd1, hytd2: row.hytd2, ytd: row.ytd };
}

function formatCardQuota(value: number | null, mode: SummaryUnit): string {
  if (value == null) return "—";
  if (mode === "hari") return formatHours(toSummaryAmount(value, mode));
  return formatQuotaDisplay(value);
}

function formatCardAmount(value: number | null, period: PeriodKey, mode: SummaryUnit): string {
  if (value == null) return "—";
  if (mode === "jam" && period === "daily") return formatHourClock(value);
  return formatHours(toSummaryAmount(value, mode));
}

function sisaTone(left: number | null, quota: number | null): "ok" | "half" | "minus" | "idle" {
  if (left == null || quota == null) return "idle";
  if (left < 0) return "minus";
  if (left <= quota * 0.5) return "half";
  return "ok";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyHours(): Hours {
  return { daily: 0, wtd: 0, mtd: 0, hytd1: 0, hytd2: 0, ytd: 0 };
}

function asOfDate(asOf: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
