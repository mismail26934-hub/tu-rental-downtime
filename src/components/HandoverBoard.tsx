"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HandoverForm } from "@/components/HandoverForm";
import { HandoverTable } from "@/components/HandoverTable";
import { Topbar } from "@/components/Topbar";
import { sendMutation, type MutationResult } from "@/lib/api";
import { computeMetrics, deriveStatus } from "@/lib/calc";
import { defaultShift, todayISO } from "@/lib/format";
import { deleteDraft, loadDraft, saveDraft } from "@/lib/offline/draft";
import { flushOutbox } from "@/lib/offline/outbox";
import { isHmValidationMessage, validateRowInput } from "@/lib/row-input";
import { useOfflineReady } from "@/app/providers";
import { useBoardView } from "@/lib/board-view";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import type { SummaryReport } from "@/lib/summary";
import { sisaByUnit } from "@/lib/unit-sisa";
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
  const offlineReady = useOfflineReady();
  const queryClient = useQueryClient();
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RowInput>(emptyRowInput);
  const [hydratedKey, setHydratedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [freezeCols, setFreezeCols] = useState(true);
  const editMode = useBoardView((state) => state.editMode);
  const setEditMode = useBoardView((state) => state.setEditMode);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
      if (cancel) return;
      if (localStorage.getItem("tu-rental-freeze") === "0") setFreezeCols(false);
      setFiltersReady(true);
      void useBoardView.persist.rehydrate();
    })();
    return () => {
      cancel = true;
    };
  }, []);

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
        setForm(draft.value);
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
    setFormOpen(false);
    setMode("create");
    setEditingId(null);
    setForm(emptyRowInput());
    setFormError("");
  }

  function openCreate() {
    closeForm();
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(row: HandoverRow) {
    setMode("edit");
    setEditingId(row.id);
    setForm(toRowInput(row));
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  useEffect(() => {
    if (!formOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeForm();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen]);

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
      setFormOpen(false);
      setMode("create");
      setEditingId(null);
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
    const error = validateRowInput(form);
    if (error) {
      setFormError(error);
      return;
    }
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
      downloadHandoverExcel({
        date: exportYear,
        shift: "",
        rows: data.rows,
        now,
        query: "",
        sisa: sisaByUnit(summary.units, summary.asOf),
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
  const readyCount = rows.filter((row) => computeMetrics(row, now).dtLabel === "N/Y Ready").length;
  const rd30Count = rows.filter((row) => row.rd30_at.trim()).length;
  const rtCount = rows.filter((row) => row.status.trim().toUpperCase() === "RT").length;

  if (status === "loading" || !filtersReady) {
    return <div className="page-loading">Memuat…</div>;
  }

  return (
    <>
      <Topbar
        busy={boardQuery.isFetching}
        onRefresh={() => void boardQuery.refetch()}
      />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>{year}</h2>
            <div className="board-filters">
              <label>
                Tahun
                <select
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
              </label>
            </div>
          </div>
          {boardQuery.isError ? (
            <div className="error">
              {boardQuery.error instanceof Error
                ? boardQuery.error.message
                : "Gagal memuat data"}
            </div>
          ) : null}
          <div className="summary">
            <div className="stat">
              <div className="label">Baris</div>
              <div className="value">{rows.length}</div>
            </div>
            <div className="stat">
              <div className="label">N/Y Ready</div>
              <div className="value">{readyCount}</div>
            </div>
            <div className="stat">
              <div className="label">RD30</div>
              <div className="value">{rd30Count}</div>
            </div>
            <div className="stat">
              <div className="label">Status RT</div>
              <div className="value">{rtCount}</div>
            </div>
          </div>
        </section>

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
                onChange={setForm}
                onHmCheck={applyHmError}
                onSubmit={submitForm}
                onCancel={closeForm}
                onDiscardDraft={() => void discardDraft()}
              />
            </div>
          </div>
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

        <section className="panel">
          <div className="panel-head">
            <h2>Daftar unit</h2>
            <div className="panel-actions">
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
              <ManageMenu
                freezeCols={freezeCols}
                onFreeze={(next) => {
                  setFreezeCols(next);
                  localStorage.setItem("tu-rental-freeze", next ? "1" : "0");
                }}
                onExport={openExport}
              />
              <button className="btn btn-primary" type="button" aria-label="Tambah unit" onClick={openCreate}>
                <PlusIcon />
                <span className="btn-label">Tambah unit</span>
              </button>
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
            </div>
          </div>
          {!formOpen && notice ? <div className="notice">{notice}</div> : null}
          <HandoverTable
            rows={rows}
            now={now}
            query={search}
            selectedId={editingId}
            frozen={freezeCols}
            editable={editMode}
            sisa={sisa}
            emptyText="Belum ada unit pada tahun ini."
            onEdit={openEdit}
            onDelete={(row) => {
              if (!window.confirm(`Hapus unit ${row.unit}?`)) return;
              deleteMutation.mutate(row.id);
            }}
          />
        </section>
      </main>
    </>
  );
}

function ManageMenu({
  freezeCols,
  onFreeze,
  onExport,
}: {
  freezeCols: boolean;
  onFreeze: (next: boolean) => void;
  onExport: () => void;
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
        <div className="kelola-menu" role="menu">
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
          <Link className="kelola-item" role="menuitem" href="/" onClick={() => setOpen(false)}>
            <SummaryIcon />
            Summary
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SummaryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M3 20h18" />
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

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
