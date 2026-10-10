"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useGroups } from "@/components/GroupSelect";
import { Topbar } from "@/components/Topbar";
import { validateGroupInput, type UnitGroup } from "@/lib/groups";
import { formatQuota, parseQuota } from "@/lib/units";

type Draft = {
  id: string;
  group: string;
  quota: string;
};

const emptyDraft = (): Draft => ({
  id: "",
  group: "",
  quota: "",
});

export function GroupMaster() {
  const queryClient = useQueryClient();
  const groupsQuery = useGroups();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const groups = groupsQuery.data || [];
    if (!needle) return groups;
    return groups.filter((group) =>
      `${group.group} ${formatQuota(group.quota_hrs)}`.toLowerCase().includes(needle)
    );
  }, [search, groupsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => {
      const message = validateGroupInput(input);
      if (message) throw new Error(message);
      const quota = parseQuota(input.quota);
      if (quota == null) throw new Error("Quota Hrs harus angka");
      const creating = !input.id;
      const id = input.id || crypto.randomUUID();
      const response = await fetch(creating ? "/api/groups" : `/api/groups/${id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          group: input.group.trim(),
          quota_hrs: String(quota),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menyimpan");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDraft(null);
      setNotice("Tersimpan.");
    },
    onError: (saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (group: UnitGroup) => {
      const response = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menghapus");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      setNotice("Group dihapus.");
    },
    onError: (deleteError) => {
      setNotice(deleteError instanceof Error ? deleteError.message : "Gagal menghapus");
    },
  });

  function openCreate() {
    setError("");
    setNotice("");
    setDraft(emptyDraft());
  }

  function openEdit(group: UnitGroup) {
    setError("");
    setNotice("");
    setDraft({
      id: group.id,
      group: group.group,
      quota: formatQuota(group.quota_hrs),
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const message = validateGroupInput(draft);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    saveMutation.mutate(draft);
  }

  return (
    <>
      <Topbar busy={groupsQuery.isFetching} onRefresh={() => void groupsQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>Master group</h2>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="action-row">
                <Link className="btn" href="/master/unit" aria-label="Master unit">
                  <UnitIcon />
                  <span className="btn-label">Master unit</span>
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
                placeholder="Cari group"
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
          {groupsQuery.isError ? (
            <div className="error">
              {groupsQuery.error instanceof Error ? groupsQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <div className="handover-table-wrap">
            <table className="handover-table master-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th className="col-num">Quota Hrs</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="handover-empty" colSpan={3}>
                      {search.trim() ? "Tidak ada data yang cocok." : "Belum ada master group."}
                    </td>
                  </tr>
                ) : (
                  rows.map((group) => (
                    <tr key={group.id}>
                      <td>{group.group}</td>
                      <td className="col-num">{formatQuota(group.quota_hrs)}</td>
                      <td className="col-act">
                        <button className="btn btn-sm" type="button" onClick={() => openEdit(group)}>
                          Ubah
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Hapus group ${group.group}?`)) return;
                            deleteMutation.mutate(group);
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
          <div className="form-modal-backdrop" onMouseDown={() => setDraft(null)}>
            <div
              className="form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="group-master-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form className="form" onSubmit={submit}>
                <div className="panel-head">
                  <h2 id="group-master-title">{draft.id ? "Ubah group" : "Tambah group"}</h2>
                </div>
                <div className="form-grid">
                  <label>
                    Group
                    <input
                      value={draft.group}
                      onChange={(event) => setDraft({ ...draft, group: event.target.value })}
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
                </div>
                {error ? <div className="error">{error}</div> : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button className="btn" type="button" onClick={() => setDraft(null)}>
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

function UnitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
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
