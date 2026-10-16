"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { EditIcon, TrashIcon } from "@/components/ActionIcons";
import { GroupSelect } from "@/components/GroupSelect";
import { MasterUnitUpload } from "@/components/MasterUnitUpload";
import { ModelSelect } from "@/components/ModelSelect";
import { CollapseBoard, ModelSummary } from "@/components/ModelSummary";
import { PageShimmer } from "@/components/PageShimmer";
import { SisaValue } from "@/components/SisaValue";
import { compareNumber, compareText, SortColumn, type SortDir } from "@/components/SortColumn";
import { useUnits } from "@/components/UnitSelect";
import { Topbar } from "@/components/Topbar";
import { canManage, isSuperuser } from "@/lib/access";
import { useManualRefresh } from "@/lib/use-manual-refresh";
import { formatHourClock, formatHours, formatQuotaDisplay } from "@/lib/format";
import { rehydrateMasterView, useMasterView } from "@/lib/master-view";
import { rehydrateModelCardFields } from "@/lib/model-card-fields";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import { PERIODS, periodQuota, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { toSummaryAmount, useSummaryView, type SummaryColumns, type SummaryMetric, type SummaryUnit } from "@/lib/summary-view";
import { sisaRemainder } from "@/lib/unit-sisa";
import { formatQuota, parseQuota, validateUnitInput, type UnitMaster } from "@/lib/units";
import { rehydrateWaScheduleView } from "@/lib/wa-schedule-view";

type Draft = {
  id: string;
  model: string;
  quota: string;
  unit: string;
  group: string;
};

type PeriodMetric = "quota" | "jam" | "sisa";
type UnitSortKey = "model" | "quota" | "unit" | "group" | "groupQuota" | `${"unit" | "group"}-${PeriodKey}-${PeriodMetric}`;
type Hours = Record<PeriodKey, number>;
type MasterRow = UnitMaster & { unitHours: Hours | null; groupHours: Hours | null };

const PERIOD_LABEL: Record<PeriodKey, string> = {
  daily: "Daily",
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

const PERIOD_METRICS: PeriodMetric[] = ["quota", "jam", "sisa"];
const METRIC_LABEL: Record<SummaryUnit, Record<PeriodMetric, string>> = {
  jam: { quota: "Quota Hrs", jam: "Jam", sisa: "Sisa" },
  hari: { quota: "Quota Hari", jam: "Hari", sisa: "Sisa" },
};

function visibleMetrics(columns: SummaryColumns): PeriodMetric[] {
  return PERIOD_METRICS.filter((metric) => columns[metric]);
}

function masterColumnCount(span: number, canWrite: boolean): number {
  return 5 + span * PERIODS.length * 2 + (canWrite ? 1 : 0);
}

const emptyDraft = (): Draft => ({
  id: "",
  model: "",
  quota: "",
  unit: "",
  group: "",
});

export function UnitMaster() {
  const { data: session } = useSession();
  const canWrite = canManage(session?.user?.level);
  const allowSchedule = isSuperuser(session?.user?.level);
  const queryClient = useQueryClient();
  const unitsQuery = useUnits();
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const mode = useSummaryView((state) => state.unit);
  const columns = useSummaryView((state) => state.columns);
  const [ready, setReady] = useState(false);
  const [freezeCols, setFreezeCols] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const summaryQuery = useQuery({
    queryKey: ["dt-summary", year],
    queryFn: () => fetchSummary(year),
    enabled: ready,
    refetchInterval: 30_000,
  });
  const { refreshing, refresh } = useManualRefresh();
  const showShimmer = !ready || unitsQuery.isLoading || refreshing;
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: UnitSortKey; dir: SortDir } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editBaseline, setEditBaseline] = useState<Draft | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const asOf = summaryQuery.data?.asOf || "";
  const tableHidden = useMasterView((state) => state.tableHidden);
  const setTableHidden = useMasterView((state) => state.setTableHidden);
  const cardsHidden = useMasterView((state) => state.cardsHidden);
  const setCardsHidden = useMasterView((state) => state.setCardsHidden);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useSheetYear.persist.rehydrate();
      await useSummaryView.persist.rehydrate();
      await rehydrateMasterView();
      await rehydrateModelCardFields();
      await rehydrateWaScheduleView();
      if (cancel) return;
      if (localStorage.getItem("tu-rental-freeze") === "0") setFreezeCols(false);
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const units = unitsQuery.data || [];
    const filtered = needle
      ? units.filter((unit) =>
          `${unit.unit} ${unit.model} ${unit.group || ""} ${formatQuota(unit.quota_hrs)} ${unit.group_quota_hrs == null ? "" : formatQuota(unit.group_quota_hrs)}`.toLowerCase().includes(needle)
        )
      : units;
    const listed = filtered.map((unit) => ({
      ...unit,
      unitHours: summaryQuery.isSuccess ? hoursForUnit(summaryQuery.data, unit.unit) : null,
      groupHours: unit.group.trim() && summaryQuery.isSuccess ? hoursForGroup(summaryQuery.data, unit.group) : null,
    }));
    if (!sort) return listed;
    return [...listed].sort((a, b) => compareUnits(a, b, sort.key, sort.dir, asOf));
  }, [search, unitsQuery.data, sort, summaryQuery.data, summaryQuery.isSuccess, asOf]);

  function toggleSort(key: UnitSortKey) {
    setSort((current) => {
      if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      const numeric = key !== "model" && key !== "unit" && key !== "group";
      return { key, dir: numeric ? "desc" : "asc" };
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => {
      const message = validateUnitInput(input);
      if (message) throw new Error(message);
      const quota = parseQuota(input.quota);
      if (quota == null) throw new Error("Quota Hrs harus angka");
      const creating = !input.id;
      const id = input.id || crypto.randomUUID();
      const response = await fetch(creating ? "/api/units" : `/api/units/${id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          model: input.model.trim(),
          quota_hrs: String(quota),
          unit: input.unit.trim(),
          group: input.group.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menyimpan");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      closeDraft();
      setNotice("Tersimpan.");
    },
    onError: (saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (unit: UnitMaster) => {
      const response = await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menghapus");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      setNotice("Unit dihapus.");
    },
    onError: (deleteError) => {
      setNotice(deleteError instanceof Error ? deleteError.message : "Gagal menghapus");
    },
  });

  function openCreate() {
    setError("");
    setNotice("");
    setEditBaseline(null);
    setDraft(emptyDraft());
  }

  function openEdit(unit: UnitMaster) {
    const next = {
      id: unit.id,
      model: unit.model,
      quota: formatQuota(unit.quota_hrs),
      unit: unit.unit,
      group: unit.group,
    };
    setError("");
    setNotice("");
    setEditBaseline(next);
    setDraft({ ...next });
  }

  function closeDraft() {
    setEditBaseline(null);
    setDraft(null);
  }

  const unitUnchanged = Boolean(
    draft?.id &&
      editBaseline &&
      draft.model.trim() === editBaseline.model.trim() &&
      draft.unit.trim() === editBaseline.unit.trim() &&
      draft.group.trim() === editBaseline.group.trim() &&
      sameQuota(draft.quota, editBaseline.quota)
  );

  async function exportExcel() {
    if (!unitsQuery.data) return;
    setExporting(true);
    setExportError("");
    try {
      const { downloadMasterUnitExcel } = await import("@/lib/export-excel");
      await downloadMasterUnitExcel({ units: unitsQuery.data, summary: summaryQuery.data });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Gagal mengekspor");
    } finally {
      setExporting(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || unitUnchanged) return;
    const message = validateUnitInput(draft);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    saveMutation.mutate(draft);
  }

  return (
    <>
      <Topbar
        busy={unitsQuery.isFetching || summaryQuery.isFetching || refreshing}
        onRefresh={() =>
          refresh(async () => {
            await Promise.all([unitsQuery.refetch(), summaryQuery.refetch()]);
          })
        }
      />
      <main className="app">
        {showShimmer ? <PageShimmer label="Memuat master unit…" /> : null}
        {!showShimmer ? (
        <section className="panel">
          <div className="panel-head">
            <div className="board-title">
              <h2>Master unit</h2>
              <select
                className="year-filter board-year"
                aria-label="Tahun"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                {yearChoices(year, summaryQuery.data?.years || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="action-row">
                <Link className="btn" href="/master/model" aria-label="Master model">
                  <ModelIcon />
                  <span className="btn-label">Master model</span>
                </Link>
                <Link className="btn" href="/master/group" aria-label="Master group">
                  <GroupIcon />
                  <span className="btn-label">Master group</span>
                </Link>
                {canWrite ? (
                  <>
                    <button className="btn btn-primary" type="button" aria-label="Tambah" onClick={openCreate}>
                      <PlusIcon />
                      <span className="btn-label">Tambah</span>
                    </button>
                    <button className="btn" type="button" aria-label="Upload Excel" onClick={() => setUploadOpen(true)}>
                      <UploadIcon />
                      <span className="btn-label">Upload</span>
                    </button>
                  </>
                ) : null}
                <button className="btn" type="button" aria-label="Export" disabled={!unitsQuery.data || exporting} onClick={() => void exportExcel()}>
                  <DownloadIcon />
                  <span className="btn-label">{exporting ? "Mengekspor…" : "Export"}</span>
                </button>
                <MasterSettings
                  mode={mode}
                  freezeCols={freezeCols}
                  onFreeze={(next) => {
                    setFreezeCols(next);
                    localStorage.setItem("tu-rental-freeze", next ? "1" : "0");
                  }}
                />
              </div>
              <div className="search-pair">
              <input
                className="unit-search"
                type="search"
                placeholder="Cari model atau unit"
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
            </div>
          </div>
          {notice ? <div className="notice">{notice}</div> : null}
          {exportError ? <div className="error">{exportError}</div> : null}
          {summaryQuery.isError ? <div className="error">Gagal memuat jam dan sisa.</div> : null}
          {unitsQuery.isError ? (
            <div className="error">
              {unitsQuery.error instanceof Error ? unitsQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <ModelSummary
            units={unitsQuery.data || []}
            report={summaryQuery.data}
            ready={summaryQuery.isSuccess}
            asOf={asOf}
            mode={mode}
            hidden={cardsHidden}
            onToggle={() => setCardsHidden(!cardsHidden)}
            allowWhatsapp={canWrite}
            allowSchedule={allowSchedule}
            year={year}
          />
          <CollapseBoard
            hidden={tableHidden}
            label="Tabel"
            hiddenLabel="Tabel disembunyikan"
            onToggle={() => setTableHidden(!tableHidden)}
          >
          <div className="handover-table-wrap">
            <table className={`handover-table master-table${freezeCols ? " is-frozen" : ""}`}>
              <thead>
                <tr>
                  <SortColumn className="col-pin col-pin-1" label="Model" column="model" sort={sort} rowSpan={2} onSort={toggleSort} />
                  <SortColumn className="col-num col-pin col-pin-2" label="Quota Hrs" column="quota" sort={sort} rowSpan={2} onSort={toggleSort} />
                  <SortColumn className="col-pin col-pin-3" label="Unit" column="unit" sort={sort} rowSpan={2} onSort={toggleSort} />
                  <PeriodTitles scope="unit" columns={columns} />
                  <SortColumn label="Group" column="group" sort={sort} rowSpan={2} onSort={toggleSort} />
                  <SortColumn className="col-num" label="Quota Hrs (GROUP)" column="groupQuota" sort={sort} rowSpan={2} onSort={toggleSort} />
                  <PeriodTitles scope="group" columns={columns} />
                  {canWrite ? <th rowSpan={2}>Aksi</th> : null}
                </tr>
                <tr>
                  <PeriodMetrics scope="unit" mode={mode} columns={columns} sort={sort} onSort={toggleSort} />
                  <PeriodMetrics scope="group" mode={mode} columns={columns} sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="handover-empty" colSpan={masterColumnCount(visibleMetrics(columns).length, canWrite)}>
                      {search.trim() ? "Tidak ada data yang cocok." : "Belum ada master unit."}
                    </td>
                  </tr>
                ) : (
                  rows.map((unit) => (
                    <tr key={unit.id}>
                      <td className="col-pin col-pin-1">{unit.model}</td>
                      <td className="col-num col-pin col-pin-2">{formatQuota(unit.quota_hrs)}</td>
                      <td className="col-pin col-pin-3">{unit.unit}</td>
                      <PeriodCells quota={unit.quota_hrs} hours={unit.unitHours} asOf={asOf} mode={mode} columns={columns} />
                      <td>{unit.group || "—"}</td>
                      <td className="col-num">{unit.group_quota_hrs == null ? "—" : formatQuota(unit.group_quota_hrs)}</td>
                      <PeriodCells quota={unit.group_quota_hrs} hours={unit.groupHours} asOf={asOf} mode={mode} columns={columns} />
                      {canWrite ? (
                        <td className="col-act">
                          <button className="btn btn-sm btn-edit" type="button" aria-label="Ubah" onClick={() => openEdit(unit)}>
                            <EditIcon />
                            <span className="btn-label">Ubah</span>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            type="button"
                            aria-label="Hapus"
                            onClick={() => {
                              if (!window.confirm(`Hapus unit ${unit.unit}?`)) return;
                              deleteMutation.mutate(unit);
                            }}
                          >
                            <TrashIcon />
                            <span className="btn-label">Hapus</span>
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </CollapseBoard>
        </section>
        ) : null}
        {draft ? (
          <div className="form-modal-backdrop" onMouseDown={closeDraft}>
            <div
              className="form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="unit-master-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form className="form" onSubmit={submit}>
                <div className="panel-head">
                  <h2 id="unit-master-title">{draft.id ? "Ubah unit" : "Tambah unit"}</h2>
                </div>
                <div className="form-grid">
                  <label>
                    Model
                    <ModelSelect
                      value={draft.model}
                      onChange={(model) => setDraft((current) => (current ? { ...current, model } : current))}
                    />
                  </label>
                  <label>
                    Quota Hrs
                    <input
                      inputMode="decimal"
                      value={draft.quota}
                      onChange={(event) => setDraft({ ...draft, quota: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Unit
                    <input
                      value={draft.unit}
                      onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Group
                    <GroupSelect
                      value={draft.group}
                      onChange={(group) => setDraft((current) => (current ? { ...current, group } : current))}
                    />
                  </label>
                </div>
                {error ? <div className="error">{error}</div> : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saveMutation.isPending || unitUnchanged}>
                    {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button className="btn" type="button" onClick={closeDraft}>
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {uploadOpen ? (
          <MasterUnitUpload
            onClose={() => setUploadOpen(false)}
            onSaved={(count) => {
              setNotice(`${count} unit ditambahkan.`);
              void queryClient.invalidateQueries({ queryKey: ["units"] });
            }}
          />
        ) : null}
      </main>
    </>
  );
}

function sameQuota(left: string, right: string): boolean {
  const a = parseQuota(left);
  const b = parseQuota(right);
  if (a == null || b == null) return left.trim() === right.trim();
  return a === b;
}

function PeriodTitles({ scope, columns }: { scope: "unit" | "group"; columns: SummaryColumns }) {
  const span = visibleMetrics(columns).length;
  if (span === 0) return null;
  return PERIODS.map((period) => (
    <th key={`${scope}-${period}`} colSpan={span} className={`summary-${period}`}>
      {PERIOD_LABEL[period]}
    </th>
  ));
}

function PeriodMetrics({
  scope,
  mode,
  columns,
  sort,
  onSort,
}: {
  scope: "unit" | "group";
  mode: SummaryUnit;
  columns: SummaryColumns;
  sort: { key: UnitSortKey; dir: SortDir } | null;
  onSort: (key: UnitSortKey) => void;
}) {
  const labels = METRIC_LABEL[mode];
  return PERIODS.map((period) =>
    visibleMetrics(columns).map((metric) => (
      <SortColumn
        key={`${scope}-${period}-${metric}`}
        className={`col-num summary-${period}`}
        label={labels[metric]}
        column={`${scope}-${period}-${metric}`}
        sort={sort}
        onSort={onSort}
      />
    ))
  );
}

function PeriodCells({
  quota,
  hours,
  asOf,
  mode,
  columns,
}: {
  quota: number | null;
  hours: Hours | null;
  asOf: string;
  mode: SummaryUnit;
  columns: SummaryColumns;
}) {
  const now = asOfDate(asOf);
  const metrics = visibleMetrics(columns);
  return PERIODS.map((period) => {
    const tone = `col-num summary-${period}`;
    if (quota == null) {
      return metrics.map((metric) => (
        <td key={`${period}-${metric}`} className={tone}>
          —
        </td>
      ));
    }
    const periodValue = periodQuota(quota, period, now);
    const shownQuota = toSummaryAmount(periodValue, mode);
    const jam = hours?.[period] ?? null;
    const left = jam == null || periodValue == null ? null : sisaRemainder(periodValue, jam);
    const shownJam = toSummaryAmount(jam, mode);
    const shownLeft = toSummaryAmount(left, mode);
    const jamText = jam == null ? "—" : mode === "jam" && period === "daily" ? formatHourClock(jam) : formatHours(shownJam);
    const overJam = period === "daily" && jam != null && periodValue != null && jam > periodValue;
    return (
      <Fragment key={period}>
        {metrics.map((metric) => {
          if (metric === "quota") return <td key={metric} className={tone}>{shownQuota == null ? "—" : formatQuotaDisplay(shownQuota)}</td>;
          if (metric === "jam") return <td key={metric} className={overJam ? `${tone} is-over` : tone}>{jamText}</td>;
          return (
            <td key={metric} className={shownLeft != null && shownLeft < 0 ? `${tone} is-over` : tone}>
              {hours == null ? "—" : <SisaValue cell={{ left: shownLeft, quota: shownQuota }} clock={mode === "jam" && period === "daily"} />}
            </td>
          );
        })}
      </Fragment>
    );
  });
}

function MasterSettings({
  mode,
  freezeCols,
  onFreeze,
}: {
  mode: SummaryUnit;
  freezeCols: boolean;
  onFreeze: (next: boolean) => void;
}) {
  const columns = useSummaryView((state) => state.columns);
  const setColumn = useSummaryView((state) => state.setColumn);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = visibleMetrics(columns).length;

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
          <div className="summary-settings-menu" role="group" aria-label="Kolom periode">
            <p className="sheet-title">Setting</p>
            {PERIOD_METRICS.map((metric) => (
              <label key={metric}>
                <input
                  type="checkbox"
                  checked={columns[metric]}
                  disabled={columns[metric] && shown === 1}
                  onChange={(event) => setColumn(metric as SummaryMetric, event.target.checked)}
                />
                {METRIC_LABEL[mode][metric]}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={freezeCols} onChange={(event) => onFreeze(event.target.checked)} />
              Freeze kolom
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
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

function compareUnits(a: MasterRow, b: MasterRow, key: UnitSortKey, dir: SortDir, asOf: string): number {
  if (key === "quota") return compareNumber(a.quota_hrs, b.quota_hrs, dir);
  if (key === "groupQuota") return compareNumber(a.group_quota_hrs, b.group_quota_hrs, dir);
  const match = /^(unit|group)-(daily|wtd|mtd|hytd1|hytd2|ytd)-(quota|jam|sisa)$/.exec(key);
  if (match) {
    const now = asOfDate(asOf);
    return compareNumber(
      metricValue(a, match[1] as "unit" | "group", match[2] as PeriodKey, match[3] as PeriodMetric, now),
      metricValue(b, match[1] as "unit" | "group", match[2] as PeriodKey, match[3] as PeriodMetric, now),
      dir
    );
  }
  if (key === "unit") return compareText(a.unit, b.unit, dir);
  if (key === "group") return compareText(a.group, b.group, dir);
  return compareText(a.model, b.model, dir);
}

async function fetchSummary(year: string): Promise<SummaryReport> {
  const response = await fetch(`/api/summary?year=${year}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal memuat summary");
  return (await response.json()) as SummaryReport;
}

function pickHours(row: SummaryRow | undefined): Hours | null {
  if (!row) return null;
  return { daily: row.daily, wtd: row.wtd, mtd: row.mtd, hytd1: row.hytd1, hytd2: row.hytd2, ytd: row.ytd };
}

function emptyHours(): Hours {
  return { daily: 0, wtd: 0, mtd: 0, hytd1: 0, hytd2: 0, ytd: 0 };
}

function hoursForUnit(report: SummaryReport | undefined, code: string): Hours {
  const row = report?.units.find((item) => item.unit.trim().toLowerCase() === code.trim().toLowerCase());
  return pickHours(row) ?? emptyHours();
}

function hoursForGroup(report: SummaryReport | undefined, group: string): Hours {
  const row = report?.groups.find((item) => item.label.trim().toLowerCase() === group.trim().toLowerCase());
  return pickHours(row) ?? emptyHours();
}

function asOfDate(asOf: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function metricValue(row: MasterRow, scope: "unit" | "group", period: PeriodKey, metric: PeriodMetric, now: Date): number | null {
  const quota = scope === "unit" ? row.quota_hrs : row.group_quota_hrs;
  const hours = scope === "unit" ? row.unitHours : row.groupHours;
  if (quota == null) return null;
  const periodValue = periodQuota(quota, period, now);
  if (metric === "quota") return periodValue;
  if (hours == null || periodValue == null) return null;
  if (metric === "jam") return hours[period];
  return sisaRemainder(periodValue, hours[period]);
}

function ModelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V9" />
      <path d="M7 13l5-5 5 5" />
      <path d="M5 4h14" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
