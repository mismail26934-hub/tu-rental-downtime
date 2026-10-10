"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { GroupSelect } from "@/components/GroupSelect";
import { compareNumber, compareText, SortColumn, type SortDir } from "@/components/SortColumn";
import { useUnits } from "@/components/UnitSelect";
import { Topbar } from "@/components/Topbar";
import { formatQuota, parseQuota, validateUnitInput, type UnitMaster } from "@/lib/units";

type Draft = {
  id: string;
  model: string;
  quota: string;
  unit: string;
  group: string;
};

type UnitSortKey = "model" | "quota" | "unit" | "group" | "groupQuota";

const emptyDraft = (): Draft => ({
  id: "",
  model: "",
  quota: "",
  unit: "",
  group: "",
});

export function UnitMaster() {
  const queryClient = useQueryClient();
  const unitsQuery = useUnits();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: UnitSortKey; dir: SortDir } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editBaseline, setEditBaseline] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const units = unitsQuery.data || [];
    const filtered = needle
      ? units.filter((unit) =>
          `${unit.unit} ${unit.model} ${unit.group || ""} ${formatQuota(unit.quota_hrs)} ${unit.group_quota_hrs == null ? "" : formatQuota(unit.group_quota_hrs)}`.toLowerCase().includes(needle)
        )
      : units;
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => compareUnits(a, b, sort.key, sort.dir));
  }, [search, unitsQuery.data, sort]);

  function toggleSort(key: UnitSortKey) {
    setSort((current) => {
      if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "quota" || key === "groupQuota" ? "desc" : "asc" };
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
      <Topbar busy={unitsQuery.isFetching} onRefresh={() => void unitsQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>Master unit</h2>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="action-row">
                <Link className="btn" href="/master/group" aria-label="Master group">
                  <GroupIcon />
                  <span className="btn-label">Master group</span>
                </Link>
                <button className="btn btn-primary" type="button" aria-label="Tambah" onClick={openCreate}>
                  <PlusIcon />
                  <span className="btn-label">Tambah</span>
                </button>
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
          {unitsQuery.isError ? (
            <div className="error">
              {unitsQuery.error instanceof Error ? unitsQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <div className="handover-table-wrap">
            <table className="handover-table master-table">
              <thead>
                <tr>
                  <SortColumn label="Model" column="model" sort={sort} onSort={toggleSort} />
                  <SortColumn className="col-num" label="Quota Hrs" column="quota" sort={sort} onSort={toggleSort} />
                  <SortColumn label="Unit" column="unit" sort={sort} onSort={toggleSort} />
                  <SortColumn label="Group" column="group" sort={sort} onSort={toggleSort} />
                  <SortColumn className="col-num" label="Quota Hrs (GROUP)" column="groupQuota" sort={sort} onSort={toggleSort} />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="handover-empty" colSpan={6}>
                      {search.trim() ? "Tidak ada data yang cocok." : "Belum ada master unit."}
                    </td>
                  </tr>
                ) : (
                  rows.map((unit) => (
                    <tr key={unit.id}>
                      <td>{unit.model}</td>
                      <td className="col-num">{formatQuota(unit.quota_hrs)}</td>
                      <td>{unit.unit}</td>
                      <td>{unit.group || "—"}</td>
                      <td className="col-num">{unit.group_quota_hrs == null ? "—" : formatQuota(unit.group_quota_hrs)}</td>
                      <td className="col-act">
                        <button className="btn btn-sm" type="button" onClick={() => openEdit(unit)}>
                          Ubah
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Hapus unit ${unit.unit}?`)) return;
                            deleteMutation.mutate(unit);
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
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
                    <input
                      value={draft.model}
                      onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                      required
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

function compareUnits(a: UnitMaster, b: UnitMaster, key: UnitSortKey, dir: SortDir): number {
  if (key === "quota") return compareNumber(a.quota_hrs, b.quota_hrs, dir);
  if (key === "groupQuota") return compareNumber(a.group_quota_hrs, b.group_quota_hrs, dir);
  if (key === "unit") return compareText(a.unit, b.unit, dir);
  if (key === "group") return compareText(a.group, b.group, dir);
  return compareText(a.model, b.model, dir);
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
