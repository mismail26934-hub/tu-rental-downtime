"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { HandoverForm } from "@/components/HandoverForm";
import { UnitUpload } from "@/components/UnitUpload";
import { HandoverTable } from "@/components/HandoverTable";
import { CollapseBoard, ModelSummary, type ModelSummaryUnit } from "@/components/ModelSummary";
import { SummaryUnitToggle } from "@/components/SummaryUnitToggle";
import { useUnits } from "@/components/UnitSelect";
import { PageShimmer } from "@/components/PageShimmer";
import { Topbar } from "@/components/Topbar";
import { canManage } from "@/lib/access";
import { useManualRefresh } from "@/lib/use-manual-refresh";
import { sendMutation, type MutationResult } from "@/lib/api";
import { computeMetrics, deriveStatus } from "@/lib/calc";
import { defaultShift, todayISO } from "@/lib/format";
import { deleteDraft, loadDraft, saveDraft } from "@/lib/offline/draft";
import { flushOutbox } from "@/lib/offline/outbox";
import { isHmValidationMessage, sameRowInput, validateRowInput } from "@/lib/row-input";
import { useOfflineReady } from "@/app/providers";
import { useBoardView } from "@/lib/board-view";
import { rehydrateModelCardFields } from "@/lib/model-card-fields";
import { useSummaryView } from "@/lib/summary-view";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import type { SummaryReport } from "@/lib/summary";
import { sisaByUnit } from "@/lib/unit-sisa";
import type { UnitMaster } from "@/lib/units";
import {
  emptyRowInput,
  toRowInput,
  type BoardData,
  type HandoverRow,
  type HandoverSheet,
  type RowInput,
  type Shift,
} from "@/lib/types";

type SavedBoard = { sheet: HandoverSheet; row: HandoverRow };
type SavedRow = { row: HandoverRow };

function sheetStorageKey(date: string, shift: string) {
  return `tu-rental-sheet:${date}:${shift}`;
}

function resolveSheetId(date: string, shift: string, existing?: string | null) {
  if (existing) {
    sessionStorage.setItem(sheetStorageKey(date, shift), existing);
    return existing;
  }
  const stored = sessionStorage.getItem(sheetStorageKey(date, shift));
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem(sheetStorageKey(date, shift), id);
  return id;
}

async function fetchBoard(year: string): Promise<BoardData & { years: number[] }> {
  const response = await fetch(`/api/board?year=${year}`, { cache: "no-store" });
  if (response.status === 401) {
    window.location.href = "/sign-in";
    throw new Error("Sesi berakhir");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Gagal memuat papan");
  }
  return response.json();
}

async function fetchSummary(year: string): Promise<SummaryReport> {
  const response = await fetch(`/api/summary?year=${year}`, { cache: "no-store" });
  if (response.status === 401) {
    window.location.href = "/sign-in";
    throw new Error("Sesi berakhir");
  }
  if (!response.ok) throw new Error("Gagal memuat summary");
  return response.json();
}

function targetSheet(year: string): { date: string; shift: Shift } {
  const today = todayISO();
  if (today.startsWith(`${year}-`)) return { date: today, shift: defaultShift() };
  return { date: `${year}-01-01`, shift: "DS" };
}

export function HandoverBoard() {
  const { data: session, status } = useSession();
  const canWrite = canManage(session?.user?.level);
  const offlineReady = useOfflineReady();
  const queryClient = useQueryClient();
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RowInput>(emptyRowInput);
  const [editBaseline, setEditBaseline] = useState<RowInput | null>(null);
  const [hydratedKey, setHydratedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HandoverRow | null>(null);
  const [freezeCols, setFreezeCols] = useState(true);
  const editMode = useBoardView((state) => state.editMode);
  const setEditMode = useBoardView((state) => state.setEditMode);
  const summaryHidden = useBoardView((state) => state.summaryHidden);
  const setSummaryHidden = useBoardView((state) => state.setSummaryHidden);
  const tableHidden = useBoardView((state) => state.tableHidden);
  const setTableHidden = useBoardView((state) => state.setTableHidden);
  const hourMode = useSummaryView((state) => state.unit);
  const unitsQuery = useUnits();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportYear, setExportYear] = useState(() => todayISO().slice(0, 4));
  const [exportError, setExportError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());
  const draftKey = `${year}|${editingId || "new"}`;
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useSheetYear.persist.rehydrate();
      await useSummaryView.persist.rehydrate();
      await useBoardView.persist.rehydrate();
      await rehydrateModelCardFields();
      if (cancel) return;
      if (localStorage.getItem("tu-rental-freeze") === "0") setFreezeCols(false);
      setFiltersReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const previousYear = useRef(year);
  useEffect(() => {
    if (!filtersReady || previousYear.current === year) return;
    previousYear.current = year;
    setFormOpen(false);
    setMode("create");
    setEditingId(null);
    setEditBaseline(null);
    setForm(emptyRowInput());
    setFormError("");
  }, [year, filtersReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
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
  }, [filtersReady, status]);

  const boardQuery = useQuery({
    queryKey: ["board", year],
    queryFn: () => fetchBoard(year),
    enabled: filtersReady && offlineReady,
    placeholderData: (previous) => previous,
  });

  const summaryQuery = useQuery({
    queryKey: ["dt-summary", year],
    queryFn: () => fetchSummary(year),
    enabled: filtersReady && offlineReady,
    refetchInterval: 30_000,
  });
  const sisa = useMemo(
    () => sisaByUnit(summaryQuery.data?.units || [], summaryQuery.data?.asOf || ""),
    [summaryQuery.data]
  );

  useEffect(() => {
    const listed = boardQuery.data?.years;
    if (!listed) return;
    setYearOptions(listed);
  }, [boardQuery.data?.years]);

  useEffect(() => {
    let cancel = false;
    setHydratedKey("");
    void loadDraft(draftKey).then((draft) => {
      if (cancel) return;
      if (draft && JSON.stringify(draft.value) !== JSON.stringify(emptyRowInput())) {
        setForm({ ...emptyRowInput(), ...draft.value });
        setNotice("Draft dipulihkan dari perangkat.");
      }
      setHydratedKey(draftKey);
    });
    return () => {
      cancel = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (hydratedKey !== draftKey) return;
    const timer = window.setTimeout(() => {
      if (JSON.stringify(form) === JSON.stringify(emptyRowInput())) {
        void deleteDraft(draftKey);
        return;
      }
      void saveDraft(draftKey, form);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftKey, form, hydratedKey]);

  function closeForm() {
    setSaveConfirm(false);
    setFormOpen(false);
    setMode("create");
    setEditingId(null);
    setEditBaseline(null);
    setForm(emptyRowInput());
    setFormError("");
  }

  function openCreate() {
    closeForm();
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(row: HandoverRow) {
    const input = toRowInput(row);
    setMode("edit");
    setEditingId(row.id);
    setEditBaseline(input);
    setForm(input);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  useEffect(() => {
    if (!formOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (saveConfirm) {
        setSaveConfirm(false);
        return;
      }
      closeForm();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen, saveConfirm]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      rowId: string;
      input: RowInput;
      editing: boolean;
    }): Promise<MutationResult<SavedBoard | SavedRow>> => {
      const target = targetSheet(year);
      const sheetId = resolveSheetId(target.date, target.shift);
      if (payload.editing) {
        return sendMutation<{ row: HandoverRow }>({
          method: "PATCH",
          url: `/api/board/rows/${payload.rowId}`,
          body: payload.input,
          rowId: payload.rowId,
        });
      }
      const sheet: HandoverSheet = {
        id: sheetId,
        sheet_date: target.date,
        shift: target.shift,
        created_by: session?.user?.id || "",
        created_at: new Date().toISOString(),
      };
      return sendMutation<{ sheet: HandoverSheet; row: HandoverRow }>({
        method: "POST",
        url: "/api/board/rows",
        body: { sheet, row: { ...payload.input, id: payload.rowId } },
        rowId: payload.rowId,
      });
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["board", year] });
      const previous = queryClient.getQueryData<BoardData>(["board", year]);
      const target = targetSheet(year);
      const sheetId = resolveSheetId(target.date, target.shift);
      const optimistic: HandoverRow = {
        ...payload.input,
        id: payload.rowId,
        sheet_id: previous?.rows.find((row) => row.id === payload.rowId)?.sheet_id || sheetId,
        sort_order: previous?.rows.find((row) => row.id === payload.rowId)?.sort_order
          ?? (previous?.rows.length || 0) + 1,
        updated_at: new Date().toISOString(),
        updated_by: session?.user?.id || "",
      };
      queryClient.setQueryData<BoardData>(["board", year], (old) => {
        const base = old ?? { sheet: null, rows: [] };
        const exists = base.rows.some((row) => row.id === payload.rowId);
        const rows = exists
          ? base.rows.map((row) => (row.id === payload.rowId ? optimistic : row))
          : [...base.rows, optimistic];
        return { sheet: null, rows };
      });
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["board", year], context.previous);
      }
      setFormError(error instanceof Error ? error.message : "Gagal menyimpan");
    },
    onSuccess: async (result, payload) => {
      const saved = result.data;
      if (!result.queued && saved && "sheet" in saved) {
        sessionStorage.setItem(sheetStorageKey(saved.sheet.sheet_date, saved.sheet.shift), saved.sheet.id);
        queryClient.setQueryData<BoardData>(["board", year], (old) => {
          const rows = (old?.rows || []).map((row) =>
            row.id === payload.rowId ? { ...saved.row, sheet_id: saved.sheet.id } : row
          );
          if (!rows.some((row) => row.id === saved.row.id)) rows.push(saved.row);
          return { sheet: null, rows };
        });
      } else if (!result.queued && result.data && "row" in result.data) {
        const savedRow = result.data.row;
        queryClient.setQueryData<BoardData>(["board", year], (old) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.map((row) => (row.id === savedRow.id ? savedRow : row)),
          };
        });
      }
      await deleteDraft(draftKeyRef.current);
      setNotice(
        result.queued
          ? "Tersimpan di perangkat. Akan dikirim saat online."
          : "Tersimpan."
      );
      setFormError("");
      setSaveConfirm(false);
      setFormOpen(false);
      setMode("create");
      setEditingId(null);
      setEditBaseline(null);
      setForm(emptyRowInput());
      if (!result.queued) void flushOutbox();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (rowId: string) =>
      sendMutation<{ ok: boolean }>({
        method: "DELETE",
        url: `/api/board/rows/${rowId}`,
        rowId,
      }),
    onMutate: async (rowId) => {
      await queryClient.cancelQueries({ queryKey: ["board", year] });
      const previous = queryClient.getQueryData<BoardData>(["board", year]);
      queryClient.setQueryData<BoardData>(["board", year], (old) => {
        if (!old) return old;
        return { ...old, rows: old.rows.filter((row) => row.id !== rowId) };
      });
      return { previous };
    },
    onError: (error, _rowId, context) => {
      if (context?.previous) queryClient.setQueryData(["board", year], context.previous);
      setFormError(error instanceof Error ? error.message : "Gagal menghapus");
    },
    onSuccess: (result, rowId) => {
      if (editingId === rowId) closeForm();
      setNotice(result.queued ? "Dihapus di perangkat. Akan dikirim saat online." : "Baris dihapus.");
      if (!result.queued) void flushOutbox();
    },
  });

  function applyHmError(message: string | null) {
    setFormError((current) => {
      if (message) return message;
      if (isHmValidationMessage(current)) return "";
      return current;
    });
  }

  function submitForm() {
    if (mode === "edit" && editBaseline && sameRowInput(form, editBaseline)) return;
    const error = validateRowInput(form);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError("");
    setSaveConfirm(true);
  }

  function confirmSave() {
    const rowId = editingId || crypto.randomUUID();
    const input = { ...form, status: deriveStatus(form) };
    saveMutation.mutate({ rowId, input, editing: mode === "edit" });
  }

  async function discardDraft() {
    await deleteDraft(draftKey);
    if (editingId) {
      const row = boardQuery.data?.rows.find((item) => item.id === editingId);
      setForm(row ? toRowInput(row) : emptyRowInput());
    } else {
      setForm(emptyRowInput());
    }
    setFormError("");
    setNotice("Draft dibuang.");
  }

  async function exportExcel() {
    setExporting(true);
    setExportError("");
    try {
      const data = await fetchBoard(exportYear);
      const summary = await fetchSummary(exportYear);
      const { downloadHandoverExcel } = await import("@/lib/export-excel");
      await downloadHandoverExcel({
        date: exportYear,
        shift: "",
        rows: data.rows,
        now,
        query: "",
        sisa: sisaByUnit(summary.units, summary.asOf),
        summary,
      });
      setExportOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Gagal mengekspor");
    } finally {
      setExporting(false);
    }
  }

  function openExport() {
    setExportYear(todayISO().slice(0, 4));
    setExportError("");
    setExportOpen(true);
  }

  const rows = boardQuery.data?.rows || [];
  const notReadyCount = useMemo(() => countNotReadyUnits(rows, now), [rows, now]);
  const summaryUnits = useMemo(
    () => (unitsQuery.isFetched ? boardSummaryUnits(rows, unitsQuery.data || []) : []),
    [rows, unitsQuery.data, unitsQuery.isFetched]
  );
  const { refreshing, refresh } = useManualRefresh();
  const showShimmer = boardQuery.isLoading || refreshing;

  if (status === "loading" || !filtersReady) {
    return (
      <>
        <Topbar busy onRefresh={() => undefined} />
        <main className="app">
          <PageShimmer label="Memuat…" />
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        busy={boardQuery.isFetching || summaryQuery.isFetching || refreshing}
        onRefresh={() =>
          refresh(async () => {
            setNow(new Date());
            await Promise.all([boardQuery.refetch(), summaryQuery.refetch()]);
          })
        }
      />
      <main className="app">
        {showShimmer ? <PageShimmer label="Memuat daftar unit…" /> : null}
        {!showShimmer && boardQuery.isError ? (
          <div className="error">
            {boardQuery.error instanceof Error
              ? boardQuery.error.message
              : "Gagal memuat data"}
          </div>
        ) : null}
        {!showShimmer ? (
        <ModelSummary
          units={summaryUnits}
          report={summaryQuery.data}
          ready={summaryQuery.isSuccess}
          asOf={summaryQuery.data?.asOf || ""}
          mode={hourMode}
          hidden={summaryHidden}
          onToggle={() => setSummaryHidden(!summaryHidden)}
        />
        ) : null}

        {formOpen ? (
          <div className="form-modal-backdrop" onMouseDown={closeForm}>
            <div
              className="form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="unit-form-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <HandoverForm
                value={form}
                now={now}
                mode={mode}
                busy={saveMutation.isPending}
                ready={hydratedKey === draftKey}
                notice={notice}
                error={formError}
                unchanged={mode === "edit" && editBaseline != null && sameRowInput(form, editBaseline)}
                onChange={setForm}
                onHmCheck={applyHmError}
                onSubmit={submitForm}
                onCancel={closeForm}
                onDiscardDraft={() => void discardDraft()}
              />
            </div>
          </div>
        ) : null}

        {saveConfirm ? (
          <div className="form-modal-backdrop alert-backdrop" onMouseDown={() => setSaveConfirm(false)}>
            <div
              className="form-modal alert-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="save-confirm-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h2 id="save-confirm-title">Simpan data?</h2>
              <p>Data unit {form.unit.trim() || "ini"} akan disimpan.</p>
              <div className="form-actions">
                <button className="btn btn-primary" type="button" onClick={confirmSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
                </button>
                <button className="btn" type="button" onClick={() => setSaveConfirm(false)} disabled={saveMutation.isPending}>
                  Batal
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {uploadOpen ? (
          <UnitUpload
            year={year}
            onClose={() => setUploadOpen(false)}
            onSaved={(count) => {
              setNotice(`${count} unit ditambahkan dari Excel.`);
              void queryClient.invalidateQueries({ queryKey: ["board", year] });
              void queryClient.invalidateQueries({ queryKey: ["dt-summary", year] });
            }}
          />
        ) : null}

        {exportOpen ? (
          <div
            className="form-modal-backdrop"
            onMouseDown={() => {
              if (!exporting) setExportOpen(false);
            }}
          >
            <div
              className="form-modal export-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void exportExcel();
                }}
              >
                <div className="panel-head">
                  <h2 id="export-title">Export</h2>
                </div>
                <div className="form-grid">
                  <label className="form-span">
                    Tahun
                    <select value={exportYear} onChange={(event) => setExportYear(event.target.value)}>
                      {yearChoices(exportYear, yearOptions).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {exportError ? <div className="error">{exportError}</div> : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={exporting}>
                    <DownloadIcon />
                    {exporting ? "Mengekspor…" : "Export"}
                  </button>
                  <button className="btn" type="button" disabled={exporting} onClick={() => setExportOpen(false)}>
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {!showShimmer ? (
        <section className="panel">
          <div className="panel-head board-bar">
            <div className="board-title">
              <h2>DAFTAR UNIT</h2>
              <select
                className="year-filter board-year"
                aria-label="Tahun"
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  closeForm();
                }}
              >
                {yearChoices(year, yearOptions).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-actions">
              <SummaryUnitToggle />
              <Link className="btn desktop-only" href="/">
                <SummaryIcon />
                <span className="btn-label">Summary</span>
              </Link>
              <div className="search-pair">
                <input
                  ref={searchRef}
                  className="unit-search"
                  type="search"
                  placeholder="Unit, crew, teknisi, masalah…"
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
              <ManageMenu
                freezeCols={freezeCols}
                onFreeze={(next) => {
                  setFreezeCols(next);
                  localStorage.setItem("tu-rental-freeze", next ? "1" : "0");
                }}
                onExport={openExport}
                onUpload={canWrite ? () => setUploadOpen(true) : undefined}
                canWrite={canWrite}
              />
              {canWrite ? (
                <button className="btn btn-primary" type="button" aria-label="Tambah unit" onClick={openCreate}>
                  <PlusIcon />
                  <span className="btn-label">Tambah unit</span>
                </button>
              ) : null}
              {canWrite ? (
                <button
                  className={editMode ? "btn is-on" : "btn"}
                  type="button"
                  aria-label="Mode Edit"
                  aria-pressed={editMode}
                  onClick={() => setEditMode(!editMode)}
                >
                  <EditIcon />
                  <span className="btn-label">Mode Edit</span>
                </button>
              ) : null}
            </div>
          </div>
          {!formOpen && notice ? <div className="notice">{notice}</div> : null}
          <CollapseBoard
            hidden={tableHidden}
            label={<NotReadyTitle count={notReadyCount} />}
            hiddenLabel={<NotReadyTitle count={notReadyCount} hidden />}
            ariaLabel={`Jumlah Unit yang N/Y Ready ${notReadyCount}`}
            onToggle={() => setTableHidden(!tableHidden)}
          >
          <HandoverTable
            rows={rows}
            now={now}
            query={search}
            selectedId={editingId}
            frozen={freezeCols}
            editable={canWrite && editMode}
            sisa={sisa}
            emptyText="Belum ada unit pada tahun ini."
            onEdit={openEdit}
            onDelete={(row) => setDeleteTarget(row)}
          />
          </CollapseBoard>
        </section>
        ) : null}

        {deleteTarget ? (
          <ConfirmDelete
            title="Hapus unit?"
            message={`Data unit ${deleteTarget.unit} akan dihapus.`}
            busy={deleteMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              const rowId = deleteTarget.id;
              setDeleteTarget(null);
              deleteMutation.mutate(rowId);
            }}
          />
        ) : null}
      </main>
    </>
  );
}

function ManageMenu({
  freezeCols,
  onFreeze,
  onExport,
  onUpload,
  canWrite = false,
}: {
  freezeCols: boolean;
  onFreeze: (next: boolean) => void;
  onExport: () => void;
  onUpload?: () => void;
  canWrite?: boolean;
}) {
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
      <button className="btn" type="button" aria-label="Kelola" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ManageIcon />
        <span className="btn-label">Kelola</span>
      </button>
      {open ? (
        <>
          <button className="sheet-backdrop" type="button" aria-label="Tutup" onClick={() => setOpen(false)} />
          <div className="kelola-menu" role="menu">
            <p className="sheet-title">Kelola</p>
            <Link className="kelola-item mobile-only" role="menuitem" href="/" onClick={() => setOpen(false)}>
            <SummaryIcon />
            Summary
          </Link>
          <label className="freeze-toggle kelola-item">
            <input type="checkbox" checked={freezeCols} onChange={(event) => onFreeze(event.target.checked)} />
            Freeze kolom
          </label>
          <button
            className="kelola-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            <DownloadIcon />
            Export
          </button>
          {onUpload ? (
            <button
              className="kelola-item"
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onUpload();
              }}
            >
              <UploadIcon />
              Upload Excel
            </button>
          ) : null}
          <Link className="kelola-item" role="menuitem" href="/master/model" onClick={() => setOpen(false)}>
            <ModelIcon />
            Master model
          </Link>
          <Link className="kelola-item" role="menuitem" href="/master/group" onClick={() => setOpen(false)}>
            <GroupIcon />
            Master group
          </Link>
          <Link className="kelola-item" role="menuitem" href="/master/unit" onClick={() => setOpen(false)}>
            <UnitIcon />
            Master unit
          </Link>
          {canWrite ? (
            <Link className="kelola-item" role="menuitem" href="/backup" onClick={() => setOpen(false)}>
              <BackupIcon />
              Backup data
            </Link>
          ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotReadyTitle({ count, hidden = false }: { count: number; hidden?: boolean }) {
  return (
    <span className="is-ny-title">
      Jumlah Unit yang N/Y Ready {count}
      {hidden ? " disembunyikan" : null}
    </span>
  );
}

function countNotReadyUnits(rows: HandoverRow[], now: Date): number {
  const units = new Set<string>();
  for (const row of rows) {
    const code = row.unit.trim().toLowerCase();
    if (!code || row.unit_backup.trim()) continue;
    if (computeMetrics(row, now).dtLabel === "N/Y Ready") units.add(code);
  }
  return units.size;
}

function boardSummaryUnits(rows: HandoverRow[], master: UnitMaster[]): ModelSummaryUnit[] {
  const byCode = new Map(master.map((unit) => [unit.unit.trim().toLowerCase(), unit]));
  const seen = new Set<string>();
  const units: ModelSummaryUnit[] = [];
  for (const row of rows) {
    const code = row.unit.trim();
    const key = code.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const match = byCode.get(key);
    units.push({
      unit: match?.unit || code,
      model: match?.model.trim() || "—",
      quota_hrs: match ? match.quota_hrs : null,
    });
  }
  return units;
}

function ManageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="8" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="2" fill="currentColor" stroke="none" />
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SummaryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M3 20h18" />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" />
      <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
    </svg>
  );
}

function UnitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function BackupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
