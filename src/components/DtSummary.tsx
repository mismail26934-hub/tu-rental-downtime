"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { SisaValue } from "@/components/SisaValue";
import { SummaryUnitToggle } from "@/components/SummaryUnitToggle";
import { Topbar } from "@/components/Topbar";
import { formatHourClock, formatHours, formatQuotaDisplay, sheetTitle } from "@/lib/format";
import { periodQuota, summaryUnitMarks, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import {
  dailyColumnCount,
  periodColumnCount,
  toSummaryAmount,
  useSummaryView,
  type SummaryColumns,
  type SummaryMetric,
  type SummaryUnit,
} from "@/lib/summary-view";
import { groupByModel, sisaRemainder } from "@/lib/unit-sisa";

async function fetchSummary(year: string): Promise<SummaryReport> {
  const response = await fetch(`/api/summary?year=${year}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal memuat summary");
  return (await response.json()) as SummaryReport;
}

export function DtSummary() {
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const [ready, setReady] = useState(false);
  const [freezeCols, setFreezeCols] = useState(true);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
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
      if (localStorage.getItem("tu-rental-freeze") === "0") setFreezeCols(false);
      if (!cancel) setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const input = searchRef.current;
    if (!input) return;
    const onSearch = () => {
      setSearchDraft(input.value);
      if (!input.value.trim()) setSearch("");
    };
    input.addEventListener("search", onSearch);
    return () => input.removeEventListener("search", onSearch);
  }, []);

  const needle = search.trim().toLowerCase();
  const unitRows = (report?.units || []).filter((row) => matchesSummary(row, needle));
  const groupRows = (report?.groups || []).filter((row) => matchesSummary(row, needle));
  const unitEmpty = summaryQuery.isSuccess
    ? needle
      ? "Tidak ada yang cocok."
      : "Belum ada unit di daftar."
    : "Memuat…";
  const groupEmpty = summaryQuery.isSuccess
    ? needle
      ? "Tidak ada yang cocok."
      : "Belum ada group di daftar."
    : "Memuat…";

  return (
    <>
      <Topbar busy={summaryQuery.isFetching} onRefresh={() => void summaryQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <div className="board-title">
              <h2>SUMMARY UNIT</h2>
              <select
                className="year-filter board-year"
                aria-label="Tahun"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                {yearChoices(year, report?.years || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-actions">
              <SummaryUnitToggle />
              <Link className="btn desktop-only" href="/daftar">
                <ListIcon />
                <span className="btn-label">Daftar unit</span>
              </Link>
              <div className="search-pair">
                <input
                  ref={searchRef}
                  className="unit-search"
                  type="search"
                  aria-label="Cari summary"
                  placeholder="Model, unit, atau group"
                  value={searchDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSearchDraft(next);
                    if (!next.trim()) setSearch("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setSearch(searchDraft.trim());
                    }
                  }}
                />
                <button className="btn" type="button" aria-label="Cari" onClick={() => setSearch(searchDraft.trim())}>
                  <SearchIcon />
                  <span className="btn-label">Cari</span>
                </button>
              </div>
              <SummaryInfo report={report} />
              <SummarySettings />
              <SummaryManage
                freezeCols={freezeCols}
                onFreeze={(next) => {
                  setFreezeCols(next);
                  localStorage.setItem("tu-rental-freeze", next ? "1" : "0");
                }}
              />
            </div>
          </div>
          {summaryQuery.isError ? (
            <div className="error">
              {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <SummaryTable
            rows={unitRows}
            labelHeader="Model"
            grouped
            asOf={report?.asOf}
            frozen={freezeCols}
            empty={unitEmpty}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>SUMMARY GROUP</h2>
          </div>
          <SummaryTable
            rows={groupRows}
            labelHeader="Group"
            asOf={report?.asOf}
            frozen={freezeCols}
            empty={groupEmpty}
          />
        </section>
      </main>
    </>
  );
}

const METRICS: { key: SummaryMetric; hours: string; days: string }[] = [
  { key: "quota", hours: "Quota Hrs", days: "Quota Hari" },
  { key: "jam", hours: "Jam", days: "Hari" },
  { key: "sisa", hours: "Sisa", days: "Sisa" },
];

function SummaryInfo({ report }: { report?: SummaryReport }) {
  const unit = useSummaryView((state) => state.unit);
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
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="summary-info-menu" role="note">
            <p className="sheet-title">Info</p>
            <SummaryNote report={report} unit={unit} />
          </div>
        </>
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
  const unit = useSummaryView((state) => state.unit);
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
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="summary-settings-menu" role="group" aria-label="Kolom summary">
            <p className="sheet-title">Setting</p>
            {METRICS.map((metric) => (
              <label key={metric.key}>
                <input
                  type="checkbox"
                  checked={columns[metric.key]}
                  disabled={columns[metric.key] && visibleCount === 1}
                  onChange={(event) => setColumn(metric.key, event.target.checked)}
                />
                {unit === "hari" ? metric.days : metric.hours}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryManage({ freezeCols, onFreeze }: { freezeCols: boolean; onFreeze: (next: boolean) => void }) {
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
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="kelola-menu" role="menu">
            <p className="sheet-title">Kelola</p>
            <label className="freeze-toggle kelola-item">
              <input type="checkbox" checked={freezeCols} onChange={(event) => onFreeze(event.target.checked)} />
              Freeze kolom
            </label>
            <Link className="kelola-item mobile-only" role="menuitem" href="/daftar" onClick={() => setOpen(false)}>
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
          <Link className="kelola-item" role="menuitem" href="/backup" onClick={() => setOpen(false)}>
            <BackupIcon />
            Backup data
          </Link>
          </div>
        </>
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

function matchesSummary(row: SummaryRow, needle: string): boolean {
  if (!needle) return true;
  const unit = summaryUnitMarks(row)
    .map((item) => item.name)
    .join(" ");
  return row.label.toLowerCase().includes(needle) || unit.toLowerCase().includes(needle);
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
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

function BackupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

const PERIOD_QUOTA = [
  ["WTD", "Quota Hrs × 7"],
  ["MTD", "hingga tanggal hari ini"],
  ["HYTD 1", "hingga 30 Juni"],
  ["HYTD 2", "sejak 1 Juli"],
  ["YTD", "sejak 1 Januari"],
] as const;

function SummaryNote({ report, unit }: { report: SummaryReport; unit: SummaryUnit }) {
  const date = sheetTitle(report.asOf, "").trim();
  const open =
    report.openUnits === 0
      ? "Tidak ada unit N/Y Ready."
      : `${report.openUnits} unit masih N/Y Ready. Jam repair terus bertambah.`;
  const scale =
    unit === "hari"
      ? "Semua angka ditampilkan dalam hari. Satu hari setara 24 jam."
      : "Jam dihitung dari Waiting Labour ditambah Repair time.";

  return (
    <div className="summary-info-body">
      <p className="summary-info-lead">
        <strong>Per {date}</strong>
        <span>{open}</span>
      </p>
      <dl className="summary-info-list">
        <div>
          <dt>Satuan</dt>
          <dd>{scale}</dd>
        </div>
        <div>
          <dt>Daily</dt>
          <dd>
            Hanya menghitung hari berjalan, dimulai dari jam Waiting Labour. Nilai kembali ke nol setelah pukul 00:00,
            lalu dihitung ulang dari awal hari.
          </dd>
        </div>
        <div>
          <dt>WTD hingga YTD</dt>
          <dd>Mengikuti tanggal Waiting Labour.</dd>
        </div>
        <div>
          <dt>Quota periode</dt>
          <dd>
            Quota Hrs dikalikan jumlah hari pada periode.
            <ul>
              {PERIOD_QUOTA.map(([label, detail]) => (
                <li key={label}>
                  <span>{label}</span>
                  {detail}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Sisa</dt>
          <dd>Quota dikurangi jam. Sel kosong jika jam bernilai 0, dan berwarna merah jika hasilnya negatif.</dd>
        </div>
        <div>
          <dt>Unit Back up</dt>
          <dd>
            Jika terisi, jam seluruh periode pada baris tersebut menjadi 0. Nama unit ditampilkan hijau dan tanpa tanda *.
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryTable({
  rows,
  labelHeader,
  empty,
  grouped = false,
  asOf,
  frozen = false,
}: {
  rows: SummaryRow[];
  labelHeader: string;
  empty: string;
  grouped?: boolean;
  asOf?: string;
  frozen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<SummarySort>(null);
  const columns = useSummaryView((state) => state.columns);
  const unit = useSummaryView((state) => state.unit);
  const groups = grouped ? groupByModel(rows) : [];
  const now = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? localDate(asOf) : new Date();
  const viewGroups = sort ? groups.map((group) => ({ ...group, members: [...group.members].sort((a, b) => compareSummary(a, b, sort, now)) })).sort((a, b) => compareSummary(a, b, sort, now)) : groups;
  const viewRows = sort && !grouped ? [...rows].sort((a, b) => compareSummary(a, b, sort, now)) : rows;
  const dailySpan = dailyColumnCount(columns);
  const periodSpan = periodColumnCount(columns);
  const tableSpan = 3 + dailySpan + periodSpan * SCALED_PERIODS.length;

  function toggle(id: string) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleSort(next: ActiveSummarySort) {
    setSort((current) => {
      if (current && sameSort(current, next)) return { ...current, dir: current.dir === "asc" ? "desc" : "asc" };
      return next;
    });
  }

  return (
    <div className="handover-table-wrap">
      <table className={`handover-table summary-table${frozen ? " is-frozen" : ""}`}>
        <thead>
          <tr>
            <SortTh className="summary-pin summary-pin-1" rowSpan={2} label={labelHeader} active={sort?.kind === "label"} dir={sort?.kind === "label" ? sort.dir : "asc"} onSort={() => toggleSort({ kind: "label", dir: "asc" })} />
            <SortTh className="col-num summary-pin summary-pin-2" rowSpan={2} label={unit === "hari" ? <>Quota<br />Hari</> : <>Quota<br />Hrs</>} active={sort?.kind === "quota"} dir={sort?.kind === "quota" ? sort.dir : "desc"} onSort={() => toggleSort({ kind: "quota", dir: "desc" })} />
            <SortTh className="summary-pin summary-pin-3" rowSpan={2} label="Unit" active={sort?.kind === "unit"} dir={sort?.kind === "unit" ? sort.dir : "asc"} onSort={() => toggleSort({ kind: "unit", dir: "asc" })} />
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
            <DailyHeads columns={columns} unit={unit} sort={sort} onSort={toggleSort} />
            {SCALED_PERIODS.map((period) => (
              <PeriodHeads key={period} period={period} columns={columns} unit={unit} sort={sort} onSort={toggleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {viewRows.length === 0 ? (
            <tr>
              <td className="handover-empty" colSpan={tableSpan}>
                {empty}
              </td>
            </tr>
          ) : grouped ? (
            viewGroups.flatMap((group) => {
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
                  <Cells row={group} units={group.members} asOf={asOf} columns={columns} unit={unit} />
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
                    <Cells row={row} asOf={asOf} sisaRow={group} columns={columns} unit={unit} />
                  </tr>
                )),
              ];
            })
          ) : (
            viewRows.map((row) => (
              <tr key={row.id}>
                <td className="summary-pin summary-pin-1">{row.label}</td>
                <Cells row={row} asOf={asOf} columns={columns} unit={unit} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const SCALED_PERIODS = ["wtd", "mtd", "hytd1", "hytd2", "ytd"] as const;

const PERIOD_LABEL: Record<(typeof SCALED_PERIODS)[number], string> = {
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

type SortDir = "asc" | "desc";
type SortMetric = "quota" | "jam" | "sisa";
type ActiveSummarySort =
  | { kind: "label" | "quota" | "unit"; dir: SortDir }
  | { kind: "cell"; period: PeriodKey; metric: SortMetric; dir: SortDir };
type SummarySort = ActiveSummarySort | null;

function sameSort(current: ActiveSummarySort, next: ActiveSummarySort): boolean {
  if (current.kind !== next.kind) return false;
  if (current.kind === "cell" && next.kind === "cell") return current.period === next.period && current.metric === next.metric;
  return true;
}

function isCell(sort: SummarySort, period: PeriodKey, metric: SortMetric): boolean {
  if (!sort || sort.kind !== "cell") return false;
  return sort.period === period && sort.metric === metric;
}

function cellDir(sort: SummarySort, period: PeriodKey, metric: SortMetric): SortDir {
  return isCell(sort, period, metric) && sort ? sort.dir : "desc";
}

function SortTh({
  label,
  active,
  dir,
  className,
  rowSpan,
  onSort,
}: {
  label: ReactNode;
  active: boolean;
  dir: SortDir;
  className?: string;
  rowSpan?: number;
  onSort: () => void;
}) {
  return (
    <th className={className} rowSpan={rowSpan} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className={active ? `sort-btn is-${dir}` : "sort-btn"} type="button" onClick={onSort}>
        <span>{label}</span>
        <span className="sort-mark" aria-hidden="true">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function compareSummary(a: SummaryRow, b: SummaryRow, sort: ActiveSummarySort, now: Date): number {
  const av = sortValue(a, sort, now);
  const bv = sortValue(b, sort, now);
  const result = typeof av === "string" || typeof bv === "string"
    ? compareText(String(av ?? ""), String(bv ?? ""), sort.dir)
    : compareNumber(typeof av === "number" ? av : null, typeof bv === "number" ? bv : null, sort.dir);
  return result || a.label.localeCompare(b.label, "id", { sensitivity: "base", numeric: true }) || a.unit.localeCompare(b.unit, "id", { sensitivity: "base", numeric: true });
}

function sortValue(row: SummaryRow, sort: ActiveSummarySort, now: Date): string | number | null {
  if (sort.kind === "label") return row.label;
  if (sort.kind === "quota") return row.quota_hrs;
  if (sort.kind === "unit") return row.unit;
  if (sort.kind !== "cell") return null;
  if (sort.metric === "jam") return row[sort.period];
  const quota = sort.period === "daily" ? row.quota_hrs : periodQuota(row.quota_hrs, sort.period, now);
  if (sort.metric === "quota") return quota;
  return sisaRemainder(quota, row[sort.period]);
}

function compareNumber(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function compareText(a: string, b: string, dir: SortDir): number {
  const left = a.trim();
  const right = b.trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const order = left.localeCompare(right, "id", { sensitivity: "base", numeric: true });
  return dir === "asc" ? order : -order;
}

function DailyHeads({ columns, unit, sort, onSort }: { columns: SummaryColumns; unit: SummaryUnit; sort: SummarySort; onSort: (next: ActiveSummarySort) => void }) {
  const amount = unit === "hari" ? "Hari" : "Jam";
  return (
    <>
      {columns.jam ? (
        <SortTh className="col-num summary-daily" label={amount} active={isCell(sort, "daily", "jam")} dir={cellDir(sort, "daily", "jam")} onSort={() => onSort({ kind: "cell", period: "daily", metric: "jam", dir: "desc" })} />
      ) : null}
      {columns.sisa ? (
        <SortTh className="col-num summary-daily" label="Sisa" active={isCell(sort, "daily", "sisa")} dir={cellDir(sort, "daily", "sisa")} onSort={() => onSort({ kind: "cell", period: "daily", metric: "sisa", dir: "desc" })} />
      ) : null}
    </>
  );
}

function PeriodHeads({ period, columns, unit, sort, onSort }: { period: PeriodKey; columns: SummaryColumns; unit: SummaryUnit; sort: SummarySort; onSort: (next: ActiveSummarySort) => void }) {
  const tone = `summary-${period}`;
  const amount = unit === "hari" ? "Hari" : "Jam";
  return (
    <>
      {columns.quota ? (
        <SortTh className={`col-num ${tone}`} label={unit === "hari" ? <>Quota<br />Hari</> : <>Quota<br />Hrs</>} active={isCell(sort, period, "quota")} dir={cellDir(sort, period, "quota")} onSort={() => onSort({ kind: "cell", period, metric: "quota", dir: "desc" })} />
      ) : null}
      {columns.jam ? (
        <SortTh className={`col-num ${tone}`} label={amount} active={isCell(sort, period, "jam")} dir={cellDir(sort, period, "jam")} onSort={() => onSort({ kind: "cell", period, metric: "jam", dir: "desc" })} />
      ) : null}
      {columns.sisa ? (
        <SortTh className={`col-num ${tone}`} label="Sisa" active={isCell(sort, period, "sisa")} dir={cellDir(sort, period, "sisa")} onSort={() => onSort({ kind: "cell", period, metric: "sisa", dir: "desc" })} />
      ) : null}
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
  unit,
}: {
  row: SummaryRow;
  units?: SummaryRow[];
  asOf?: string;
  sisaRow?: SummaryRow;
  columns: SummaryColumns;
  unit: SummaryUnit;
}) {
  const now = asOf ? localDate(asOf) : new Date();
  const sisa = sisaRow ?? row;
  const dailyLeft = toSummaryAmount(sisaRemainder(sisa.quota_hrs, sisa.daily), unit);
  const dailyQuota = toSummaryAmount(sisa.quota_hrs, unit);
  const show = (value: number | null) => toSummaryAmount(value, unit);
  return (
    <>
      <td className="col-num summary-pin summary-pin-2">{row.quota_hrs == null ? "—" : formatQuotaDisplay(show(row.quota_hrs) ?? 0)}</td>
      <td className="col-units summary-pin summary-pin-3">
        <UnitNames row={row} units={units} />
      </td>
      {columns.jam ? (
        <td className={row.overDaily ? "col-num summary-daily is-over" : "col-num summary-daily"}>
          {unit === "hari" ? formatHours(show(row.daily)) : formatHourClock(row.daily)}
        </td>
      ) : null}
      {columns.sisa ? (
        <td className={dailyLeft != null && dailyLeft < 0 ? "col-num summary-daily is-over" : "col-num summary-daily"}>
          <SisaValue cell={{ left: dailyLeft, quota: dailyQuota }} clock={unit === "jam"} />
        </td>
      ) : null}
      {SCALED_PERIODS.map((period) => {
        const quota = show(periodQuota(row.quota_hrs, period, now));
        const sisaQuota = show(periodQuota(sisa.quota_hrs, period, now));
        const left = show(sisaRemainder(periodQuota(sisa.quota_hrs, period, now), sisa[period]));
        const tone = `col-num summary-${period}`;
        return (
          <Fragment key={period}>
            {columns.quota ? <td className={tone}>{quota == null ? "—" : formatQuotaDisplay(quota)}</td> : null}
            {columns.jam ? <td className={tone}>{formatHours(show(row[period]))}</td> : null}
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
  const names = summaryUnitMarks(row, units);
  if (names.length === 0) return "—";
  return names.map((item, index) => (
    <span key={`${item.name}-${index}`} className="summary-unit-line">
      <span className={item.open ? "is-ny" : item.backedUp ? "is-backup" : undefined}>
        {item.open ? `${item.name}*` : item.name}
      </span>
      {index < names.length - 1 ? "," : null}
    </span>
  ));
}
