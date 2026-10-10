"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { HandoverForm } from "@/components/HandoverForm";
import { HandoverTable } from "@/components/HandoverTable";
import { Topbar } from "@/components/Topbar";
import { sendMutation, type MutationResult } from "@/lib/api";
import { computeMetrics, deriveStatus } from "@/lib/calc";
import { defaultShift, sheetTitle, todayISO } from "@/lib/format";
import { deleteDraft, loadDraft, saveDraft } from "@/lib/offline/draft";
import { flushOutbox } from "@/lib/offline/outbox";
import { isHmValidationMessage, validateRowInput } from "@/lib/row-input";
import { useOfflineReady } from "@/app/providers";
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

async function fetchBoard(date: string, shift: Shift): Promise<BoardData> {
  const response = await fetch(`/api/board?date=${date}&shift=${shift}`, { cache: "no-store" });
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

export function HandoverBoard() {
  const { data: session, status } = useSession();
  const offlineReady = useOfflineReady();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO);
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [filtersReady, setFiltersReady] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RowInput>(emptyRowInput);
  const [hydratedKey, setHydratedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [freezeCols, setFreezeCols] = useState(true);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());
  const draftKey = `${date}|${shift}|${editingId || "new"}`;
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;

  useEffect(() => {
    const storedDate = localStorage.getItem("tu-rental-date");
    const storedShift = localStorage.getItem("tu-rental-shift");
    if (storedDate && /^\d{4}-\d{2}-\d{2}$/.test(storedDate)) setDate(storedDate);
    if (storedShift === "NS" || storedShift === "DS") setShift(storedShift);
    if (localStorage.getItem("tu-rental-freeze") === "0") setFreezeCols(false);
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    localStorage.setItem("tu-rental-date", date);
    localStorage.setItem("tu-rental-shift", shift);
  }, [date, shift, filtersReady]);

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
    queryKey: ["board", date, shift],
    queryFn: () => fetchBoard(date, shift),
    enabled: filtersReady && offlineReady,
    placeholderData: (previous) => previous,
  });

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
      const current = queryClient.getQueryData<BoardData>(["board", date, shift]);
      const sheetId = resolveSheetId(date, shift, current?.sheet?.id);
      if (payload.editing) {
        return sendMutation<{ row: HandoverRow }>({
          method: "PATCH",
          url: `/api/board/rows/${payload.rowId}`,
          body: payload.input,
          rowId: payload.rowId,
        });
      }
      const sheet: HandoverSheet = current?.sheet || {
        id: sheetId,
        sheet_date: date,
        shift,
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
      await queryClient.cancelQueries({ queryKey: ["board", date, shift] });
      const previous = queryClient.getQueryData<BoardData>(["board", date, shift]);
      const sheetId = resolveSheetId(date, shift, previous?.sheet?.id);
      const optimistic: HandoverRow = {
        ...payload.input,
        id: payload.rowId,
        sheet_id: sheetId,
        sort_order: previous?.rows.find((row) => row.id === payload.rowId)?.sort_order
          ?? (previous?.rows.length || 0) + 1,
        updated_at: new Date().toISOString(),
        updated_by: session?.user?.id || "",
      };
      queryClient.setQueryData<BoardData>(["board", date, shift], (old) => {
        const base = old ?? { sheet: null, rows: [] };
        const sheet = base.sheet ?? {
          id: sheetId,
          sheet_date: date,
          shift,
          created_by: session?.user?.id || "",
          created_at: new Date().toISOString(),
        };
        const exists = base.rows.some((row) => row.id === payload.rowId);
        const rows = exists
          ? base.rows.map((row) => (row.id === payload.rowId ? optimistic : row))
          : [...base.rows, optimistic];
        return { sheet, rows };
      });
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["board", date, shift], context.previous);
      }
      setFormError(error instanceof Error ? error.message : "Gagal menyimpan");
    },
    onSuccess: async (result, payload) => {
      const saved = result.data;
      if (!result.queued && saved && "sheet" in saved) {
        sessionStorage.setItem(sheetStorageKey(date, shift), saved.sheet.id);
        queryClient.setQueryData<BoardData>(["board", date, shift], (old) => {
          const rows = (old?.rows || []).map((row) =>
            row.id === payload.rowId ? { ...saved.row, sheet_id: saved.sheet.id } : row
          );
          if (!rows.some((row) => row.id === saved.row.id)) rows.push(saved.row);
          return { sheet: saved.sheet, rows };
        });
      } else if (!result.queued && result.data && "row" in result.data) {
        const savedRow = result.data.row;
        queryClient.setQueryData<BoardData>(["board", date, shift], (old) => {
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
      await queryClient.cancelQueries({ queryKey: ["board", date, shift] });
      const previous = queryClient.getQueryData<BoardData>(["board", date, shift]);
      queryClient.setQueryData<BoardData>(["board", date, shift], (old) => {
        if (!old) return old;
        return { ...old, rows: old.rows.filter((row) => row.id !== rowId) };
      });
      return { previous };
    },
    onError: (error, _rowId, context) => {
      if (context?.previous) queryClient.setQueryData(["board", date, shift], context.previous);
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
    try {
      const { downloadHandoverExcel } = await import("@/lib/export-excel");
      downloadHandoverExcel({ date, shift, rows, now, query: search });
    } finally {
      setExporting(false);
    }
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
            <h2>{sheetTitle(date, shift)}</h2>
            <div className="board-filters">
              <label>
                Tanggal
                <input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    closeForm();
                  }}
                />
              </label>
              <label>
                Shift
                <select
                  value={shift}
                  onChange={(event) => {
                    setShift(event.target.value as Shift);
                    closeForm();
                  }}
                >
                  <option value="DS">DS (siang)</option>
                  <option value="NS">NS (malam)</option>
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
              <button className="btn" type="button" onClick={() => setSearch(searchDraft.trim())}>
                <SearchIcon />
                Cari
              </button>
              <label className="freeze-toggle">
                <input
                  type="checkbox"
                  checked={freezeCols}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setFreezeCols(next);
                    localStorage.setItem("tu-rental-freeze", next ? "1" : "0");
                  }}
                />
                Freeze kolom
              </label>
              <button className="btn" type="button" disabled={exporting} onClick={() => void exportExcel()}>
                <DownloadIcon />
                {exporting ? "Mengekspor…" : "Export"}
              </button>
              <Link className="btn" href="/master/unit">
                Master unit
              </Link>
              <button className="btn btn-primary" type="button" onClick={openCreate}>
                <PlusIcon />
                Tambah unit
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
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
