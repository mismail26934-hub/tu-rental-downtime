"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useMemo, useState } from "react";
import { EditIcon, TrashIcon } from "@/components/ActionIcons";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useModels } from "@/components/ModelSelect";
import { compareText, SortColumn, type SortDir } from "@/components/SortColumn";
import { PageShimmer } from "@/components/PageShimmer";
import { Topbar } from "@/components/Topbar";
import { canManage } from "@/lib/access";
import { validateModelInput, type UnitModel } from "@/lib/models";
import { useManualRefresh } from "@/lib/use-manual-refresh";

type Draft = {
  id: string;
  model: string;
};

type ModelSortKey = "model";

const emptyDraft = (): Draft => ({
  id: "",
  model: "",
});

export function ModelMaster() {
  const { data: session } = useSession();
  const canWrite = canManage(session?.user?.level);
  const queryClient = useQueryClient();
  const modelsQuery = useModels();
  const { refreshing, refresh } = useManualRefresh();
  const showShimmer = modelsQuery.isLoading || refreshing;
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: ModelSortKey; dir: SortDir } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editBaseline, setEditBaseline] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnitModel | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const models = modelsQuery.data || [];
    const filtered = needle ? models.filter((model) => model.model.toLowerCase().includes(needle)) : models;
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => compareText(a.model, b.model, sort.dir));
  }, [search, modelsQuery.data, sort]);

  function toggleSort(key: ModelSortKey) {
    setSort((current) => {
      if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => {
      const message = validateModelInput(input);
      if (message) throw new Error(message);
      const creating = !input.id;
      const id = input.id || crypto.randomUUID();
      const response = await fetch(creating ? "/api/models" : `/api/models/${id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          model: input.model.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menyimpan");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models"] });
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      closeDraft();
      setNotice("Tersimpan.");
    },
    onError: (saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (model: UnitModel) => {
      const response = await fetch(`/api/models/${model.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menghapus");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models"] });
      setNotice("Model dihapus.");
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

  function openEdit(model: UnitModel) {
    const next = {
      id: model.id,
      model: model.model,
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

  const modelUnchanged = Boolean(
    draft?.id && editBaseline && draft.model.trim() === editBaseline.model.trim()
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || modelUnchanged) return;
    const message = validateModelInput(draft);
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
        busy={modelsQuery.isFetching || refreshing}
        onRefresh={() => refresh(() => modelsQuery.refetch())}
      />
      <main className="app">
        {showShimmer ? <PageShimmer label="Memuat master model…" cards={2} rows={5} /> : null}
        {!showShimmer ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Master model</h2>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/master/unit" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="action-row">
                <Link className="btn" href="/master/unit" aria-label="Master unit">
                  <UnitIcon />
                  <span className="btn-label">Master unit</span>
                </Link>
                <Link className="btn" href="/master/group" aria-label="Master group">
                  <GroupIcon />
                  <span className="btn-label">Master group</span>
                </Link>
                {canWrite ? (
                  <button className="btn btn-primary" type="button" aria-label="Tambah" onClick={openCreate}>
                    <PlusIcon />
                    <span className="btn-label">Tambah</span>
                  </button>
                ) : null}
              </div>
              <div className="search-pair">
                <input
                  className="unit-search"
                  type="search"
                  placeholder="Cari model"
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
          {modelsQuery.isError ? (
            <div className="error">
              {modelsQuery.error instanceof Error ? modelsQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <div className="handover-table-wrap">
            <table className="handover-table master-table">
              <thead>
                <tr>
                  <SortColumn label="Model" column="model" sort={sort} onSort={toggleSort} />
                  {canWrite ? <th>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="handover-empty" colSpan={canWrite ? 2 : 1}>
                      {search.trim() ? "Tidak ada data yang cocok." : "Belum ada master model."}
                    </td>
                  </tr>
                ) : (
                  rows.map((model) => (
                    <tr key={model.id}>
                      <td>{model.model}</td>
                      {canWrite ? (
                        <td className="col-act">
                          <button className="btn btn-sm btn-edit" type="button" aria-label="Ubah" onClick={() => openEdit(model)}>
                            <EditIcon />
                            <span className="btn-label">Ubah</span>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            type="button"
                            aria-label="Hapus"
                            onClick={() => setDeleteTarget(model)}
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
        </section>
        ) : null}
        {draft ? (
          <div className="form-modal-backdrop" onMouseDown={closeDraft}>
            <div
              className="form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="model-master-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form className="form" onSubmit={submit}>
                <div className="panel-head">
                  <h2 id="model-master-title">{draft.id ? "Ubah model" : "Tambah model"}</h2>
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
                </div>
                {error ? <div className="error">{error}</div> : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saveMutation.isPending || modelUnchanged}>
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
        {deleteTarget ? (
          <ConfirmDelete
            title="Hapus model?"
            message={`Model ${deleteTarget.model} akan dihapus.`}
            busy={deleteMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              const model = deleteTarget;
              setDeleteTarget(null);
              deleteMutation.mutate(model);
            }}
          />
        ) : null}
      </main>
    </>
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
