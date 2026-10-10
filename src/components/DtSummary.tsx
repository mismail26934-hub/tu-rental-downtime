"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { SisaValue } from "@/components/SisaValue";
import { Topbar } from "@/components/Topbar";
import { formatHours, sheetTitle } from "@/lib/format";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import { periodQuota, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import {
  dailyColumnCount,
  periodColumnCount,
  useSummaryView,
  type SummaryColumns,
  type SummaryMetric,
} from "@/lib/summary-view";
import { formatQuota } from "@/lib/units";
import { groupByModel, sisaRemainder } from "@/lib/unit-sisa";

async function fetchSummary(year: string): Promise<SummaryReport> {
  const response = await fetch(`/api/summary?year=${year}`);
  if (!response.ok) throw new Error("Gagal memuat summary");
  return (await response.json()) as SummaryReport;
}

export function DtSummary() {
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const [ready, setReady] = useState(false);
  const summaryQuery = useQuery({
    queryKey: ["dt-summary", year],
    queryFn: () => fetchSummary(year),
    enabled: ready,
    refetchInterval: 30_000,
  });
  const report = summaryQuery.data;

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useSheetYear.persist.rehydrate();
      await useSummaryView.persist.rehydrate();
      if (!cancel) setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <>
      <Topbar busy={summaryQuery.isFetching} onRefresh={() => void summaryQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>Summary unit</h2>
            <div className="panel-actions">
              <div className="board-filters">
                <select aria-label="Tahun" value={year} onChange={(event) => setYear(event.target.value)}>
                  {yearChoices(year, report?.years || []).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <SummaryInfo report={report} />
              <SummarySettings />
              <SummaryManage />
            </div>
          </div>
          {summaryQuery.isError ? (
            <div className="error">
              {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <SummaryTable
            rows={report?.units || []}
            labelHeader="Model"
            grouped
            asOf={report?.asOf}
            empty={summaryQuery.isSuccess ? "Belum ada unit di daftar." : "Memuat…"}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Summary group</h2>
          </div>
          <SummaryTable
            rows={report?.groups || []}
            labelHeader="Group"
            asOf={report?.asOf}
            empty={summaryQuery.isSuccess ? "Belum ada group di daftar." : "Memuat…"}
          />
        </section>
      </main>
    </>
  );
}

const METRICS: { key: SummaryMetric; label: string }[] = [
  { key: "quota", label: "Quota Hrs" },
  { key: "jam", label: "Jam" },
  { key: "sisa", label: "Sisa" },
];

function SummaryInfo({ report }: { report?: SummaryReport }) {
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
    <div className="summary-info" ref={rootRef}>
      <button
        className="btn"
        type="button"
        aria-label="Info"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon />
        <span className="btn-label">Info</span>
      </button>
      {open && report ? (
        <p className="summary-info-menu" role="note">
          {note(report)}
        </p>
      ) : null}
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function SummarySettings() {
  const columns = useSummaryView((state) => state.columns);
  const setColumn = useSummaryView((state) => state.setColumn);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleCount = METRICS.filter((metric) => columns[metric.key]).length;

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
      <button className="btn" type="button" aria-label="Setting" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <SettingsIcon />
        <span className="btn-label">Setting</span>
      </button>
      {open ? (
        <div className="summary-settings-menu" role="group" aria-label="Kolom summary">
          {METRICS.map((metric) => (
            <label key={metric.key}>
              <input
                type="checkbox"
                checked={columns[metric.key]}
                disabled={columns[metric.key] && visibleCount === 1}
                onChange={(event) => setColumn(metric.key, event.target.checked)}
              />
              {metric.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryManage() {
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
    <div className="kelola" ref={rootRef}>
      <button
        className="btn"
        type="button"
        aria-label="Kelola"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ManageIcon />
        <span className="btn-label">Kelola</span>
      </button>
      {open ? (
        <div className="kelola-menu" role="menu">
          <Link className="kelola-item" role="menuitem" href="/daftar" onClick={() => setOpen(false)}>
            <ListIcon />
            Daftar unit
          </Link>
          <Link className="kelola-item" role="menuitem" href="/master/group" onClick={() => setOpen(false)}>
            <GroupIcon />
            Master group
          </Link>
          <Link className="kelola-item" role="menuitem" href="/master/unit" onClick={() => setOpen(false)}>
            <UnitIcon />
            Master unit
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ManageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="8" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" />
      <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
    </svg>
  );
}

function UnitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function note(report: SummaryReport): string {
  const date = sheetTitle(report.asOf, "").trim();
  const open =
    report.openUnits === 0
      ? "Tidak ada unit N/Y Ready."
      : `${report.openUnits} unit masih N/Y Ready, jam repair-nya terus bertambah.`;
  return `Per ${date}. ${open} Jam = Waiting Labour + Repair time. Quota periode = Quota Hrs × hari (WTD Senin sampai hari ini, MTD tanggal hari ini, HYTD 1 sampai 30 Jun, HYTD 2 dari 1 Jul, YTD dari 1 Jan). Sisa = quota − jam, kosong jika jam 0, merah jika negatif.`;
}

function SummaryTable({
  rows,
  labelHeader,
  empty,
  grouped = false,
  asOf,
}: {
  rows: SummaryRow[];
  labelHeader: string;
  empty: string;
  grouped?: boolean;
  asOf?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const columns = useSummaryView((state) => state.columns);
  const groups = grouped ? groupByModel(rows) : [];
  const dailySpan = dailyColumnCount(columns);
  const periodSpan = periodColumnCount(columns);
  const tableSpan = 3 + dailySpan + periodSpan * SCALED_PERIODS.length;

  function toggle(id: string) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="handover-table-wrap">
      <table className="handover-table summary-table">
        <thead>
          <tr>
            <th rowSpan={2} className="summary-pin summary-pin-1">
              {labelHeader}
            </th>
            <th rowSpan={2} className="col-num summary-pin summary-pin-2">
              Quota
              <br />
              Hrs
            </th>
            <th rowSpan={2} className="summary-pin summary-pin-3">
              Unit
            </th>
            {dailySpan > 0 ? (
              <th colSpan={dailySpan} className="summary-daily">
                Daily
              </th>
            ) : null}
            {SCALED_PERIODS.map((period) => (
              <th key={period} colSpan={periodSpan} className={`summary-${period}`}>
                {PERIOD_LABEL[period]}
              </th>
            ))}
          </tr>
          <tr>
            <DailyHeads columns={columns} />
            {SCALED_PERIODS.map((period) => (
              <PeriodHeads key={period} period={period} columns={columns} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="handover-empty" colSpan={tableSpan}>
                {empty}
              </td>
            </tr>
          ) : grouped ? (
            groups.flatMap((group) => {
              const expanded = Boolean(open[group.id]);
              const canToggle = group.members.length > 1;
              const parent = (
                <tr key={group.id}>
                  <td className="summary-pin summary-pin-1">
                    <span className="summary-model">
                      {group.label}
                      {canToggle ? (
                        <button
                          className="summary-toggle"
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? `Tutup ${group.label}` : `Buka ${group.label}`}
                          onClick={() => toggle(group.id)}
                        >
                          {expanded ? "−" : "+"}
                        </button>
                      ) : null}
                    </span>
                  </td>
                  <Cells row={group} units={group.members} asOf={asOf} columns={columns} />
                </tr>
              );
              if (!expanded) return [parent];
              return [
                parent,
                ...group.members.map((row) => (
                  <tr key={row.id} className="is-detail">
                    <td className="summary-pin summary-pin-1">
                      {row.label}
                    </td>
                    <Cells row={row} asOf={asOf} sisaRow={group} columns={columns} />
                  </tr>
                )),
              ];
            })
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="summary-pin summary-pin-1">{row.label}</td>
                <Cells row={row} asOf={asOf} columns={columns} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const SCALED_PERIODS: PeriodKey[] = ["wtd", "mtd", "hytd1", "hytd2", "ytd"];

const PERIOD_LABEL: Record<(typeof SCALED_PERIODS)[number], string> = {
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

function DailyHeads({ columns }: { columns: SummaryColumns }) {
  return (
    <>
      {columns.jam ? <th className="col-num summary-daily">Jam</th> : null}
      {columns.sisa ? <th className="col-num summary-daily">Sisa</th> : null}
    </>
  );
}

function PeriodHeads({ period, columns }: { period: PeriodKey; columns: SummaryColumns }) {
  const tone = `summary-${period}`;
  return (
    <>
      {columns.quota ? (
        <th className={`col-num ${tone}`}>
          Quota
          <br />
          Hrs
        </th>
      ) : null}
      {columns.jam ? <th className={`col-num ${tone}`}>Jam</th> : null}
      {columns.sisa ? <th className={`col-num ${tone}`}>Sisa</th> : null}
    </>
  );
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function Cells({
  row,
  units,
  asOf,
  sisaRow,
  columns,
}: {
  row: SummaryRow;
  units?: SummaryRow[];
  asOf?: string;
  sisaRow?: SummaryRow;
  columns: SummaryColumns;
}) {
  const now = asOf ? localDate(asOf) : new Date();
  const sisa = sisaRow ?? row;
  const dailyLeft = sisaRemainder(sisa.quota_hrs, sisa.daily);
  return (
    <>
      <td className="col-num summary-pin summary-pin-2">{row.quota_hrs == null ? "—" : formatQuota(row.quota_hrs)}</td>
      <td className="col-units summary-pin summary-pin-3">
        <UnitNames row={row} units={units} />
      </td>
      {columns.jam ? (
        <td className={row.overDaily ? "col-num summary-daily is-over" : "col-num summary-daily"}>{formatHours(row.daily)}</td>
      ) : null}
      {columns.sisa ? (
        <td className={dailyLeft != null && dailyLeft < 0 ? "col-num summary-daily is-over" : "col-num summary-daily"}>
          <SisaValue cell={{ left: dailyLeft, quota: sisa.quota_hrs }} />
        </td>
      ) : null}
      {SCALED_PERIODS.map((period) => {
        const quota = periodQuota(row.quota_hrs, period, now);
        const sisaQuota = periodQuota(sisa.quota_hrs, period, now);
        const left = sisaRemainder(sisaQuota, sisa[period]);
        const tone = `col-num summary-${period}`;
        return (
          <Fragment key={period}>
            {columns.quota ? <td className={tone}>{quota == null ? "—" : formatQuota(quota)}</td> : null}
            {columns.jam ? <td className={tone}>{formatHours(row[period])}</td> : null}
            {columns.sisa ? (
              <td className={left != null && left < 0 ? `${tone} is-over` : tone}>
                <SisaValue cell={{ left, quota: sisaQuota }} />
              </td>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function UnitNames({ row, units }: { row: SummaryRow; units?: SummaryRow[] }) {
  const items = units
    ? units.map((item) => ({ name: item.unit, open: item.open }))
    : row.unit.split(",").map((part) => {
        const trimmed = part.trim();
        const marked = trimmed.endsWith("*");
        return { name: marked ? trimmed.slice(0, -1) : trimmed, open: marked || (row.open && !row.unit.includes(",")) };
      });
  const names = items.filter((item) => item.name);
  if (names.length === 0) return "—";
  return names.map((item, index) => (
    <span key={`${item.name}-${index}`} className="summary-unit-line">
      <span className={item.open ? "is-ny" : undefined}>{item.open ? `${item.name}*` : item.name}</span>
      {index < names.length - 1 ? "," : null}
    </span>
  ));
}
