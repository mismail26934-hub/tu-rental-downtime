"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useMemo, useState } from "react";
import { EditIcon, TrashIcon } from "@/components/ActionIcons";
import { compareText, SortColumn, type SortDir } from "@/components/SortColumn";
import { Topbar } from "@/components/Topbar";
import { USER_LEVELS, type PublicUser } from "@/lib/types";
import { validateUserInput } from "@/lib/user-input";

type Draft = {
  id: string;
  username: string;
  name: string;
  level: string;
  active: "1" | "0";
  password: string;
};

type UserSortKey = "username" | "name" | "level" | "active";

const emptyDraft = (): Draft => ({
  id: "",
  username: "",
  name: "",
  level: "user",
  active: "1",
  password: "",
});

const LEVEL_LABEL: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  user: "User",
};

async function fetchUsers(): Promise<PublicUser[]> {
  const response = await fetch("/api/users");
  if (response.status === 401) {
    window.location.href = "/sign-in";
    throw new Error("Sesi berakhir");
  }
  const body = (await response.json().catch(() => null)) as { users?: PublicUser[]; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Gagal memuat pengguna");
  return body?.users || [];
}

export function UserMaster() {
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: UserSortKey; dir: SortDir } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editBaseline, setEditBaseline] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selfId = session?.user?.id || "";

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const users = usersQuery.data || [];
    const filtered = needle
      ? users.filter((user) =>
          [user.username, user.name, LEVEL_LABEL[user.level] || user.level, user.active === "1" ? "aktif" : "nonaktif"]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : users;
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      if (sort.key === "active") return compareText(left.active, right.active, sort.dir);
      return compareText(String(left[sort.key] || ""), String(right[sort.key] || ""), sort.dir);
    });
  }, [search, sort, usersQuery.data]);

  function toggleSort(key: UserSortKey) {
    setSort((current) => {
      if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
  }

  function closeDraft() {
    setDraft(null);
    setEditBaseline(null);
  }

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => {
      const creating = !input.id;
      const message = validateUserInput(input, creating);
      if (message) throw new Error(message);
      const id = input.id || crypto.randomUUID();
      const response = await fetch(creating ? "/api/users" : `/api/users/${id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          username: input.username.trim(),
          name: input.name.trim(),
          level: input.level,
          active: input.active,
          password: input.password,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; user?: PublicUser } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menyimpan");
      return body?.user || null;
    },
    onSuccess: async (saved, input) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      if (saved && saved.id === selfId) await update({ name: saved.name });
      closeDraft();
      setNotice(input.id ? "Pengguna diubah." : "Pengguna ditambah.");
    },
    onError: (saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (user: PublicUser) => {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Gagal menghapus");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setNotice("Pengguna dihapus.");
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

  function openEdit(user: PublicUser) {
    const next: Draft = {
      id: user.id,
      username: user.username,
      name: user.name,
      level: USER_LEVELS.includes(user.level as (typeof USER_LEVELS)[number]) ? user.level : "user",
      active: user.active === "1" ? "1" : "0",
      password: "",
    };
    setError("");
    setNotice("");
    setEditBaseline(next);
    setDraft({ ...next });
  }

  const unchanged = Boolean(
    draft?.id &&
      editBaseline &&
      draft.username.trim() === editBaseline.username.trim() &&
      draft.name.trim() === editBaseline.name.trim() &&
      draft.level === editBaseline.level &&
      draft.active === editBaseline.active &&
      draft.password === ""
  );
  const editingSelf = Boolean(draft?.id && draft.id === selfId);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || unchanged) return;
    const message = validateUserInput(draft, !draft.id);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    saveMutation.mutate(draft);
  }

  return (
    <>
      <Topbar busy={usersQuery.isFetching} onRefresh={() => void usersQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>Pengguna</h2>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="action-row">
                <button className="btn btn-primary" type="button" aria-label="Tambah" onClick={openCreate}>
                  <PlusIcon />
                  <span className="btn-label">Tambah</span>
                </button>
              </div>
              <div className="search-pair">
                <input
                  className="unit-search"
                  type="search"
                  placeholder="Cari pengguna"
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
          {usersQuery.isError ? (
            <div className="error">{usersQuery.error instanceof Error ? usersQuery.error.message : "Gagal memuat data"}</div>
          ) : null}
          <div className="handover-table-wrap">
            <table className="handover-table master-table">
              <thead>
                <tr>
                  <SortColumn label="Username" column="username" sort={sort} onSort={toggleSort} />
                  <SortColumn label="Nama" column="name" sort={sort} onSort={toggleSort} />
                  <SortColumn label="Level" column="level" sort={sort} onSort={toggleSort} />
                  <SortColumn label="Status" column="active" sort={sort} onSort={toggleSort} />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="handover-empty" colSpan={5}>
                      {usersQuery.isSuccess ? (search.trim() ? "Tidak ada data yang cocok." : "Belum ada pengguna.") : "Memuat…"}
                    </td>
                  </tr>
                ) : (
                  rows.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.name || "—"}</td>
                      <td>{LEVEL_LABEL[user.level] || user.level}</td>
                      <td>{user.active === "1" ? "Aktif" : "Nonaktif"}</td>
                      <td className="col-act">
                        <button className="btn btn-sm btn-edit" type="button" aria-label="Ubah" onClick={() => openEdit(user)}>
                          <EditIcon />
                          <span className="btn-label">Ubah</span>
                        </button>
                        {user.id === selfId ? null : (
                          <button
                            className="btn btn-sm btn-danger"
                            type="button"
                            aria-label="Hapus"
                            onClick={() => {
                              if (!window.confirm(`Hapus pengguna ${user.username}?`)) return;
                              deleteMutation.mutate(user);
                            }}
                          >
                            <TrashIcon />
                            <span className="btn-label">Hapus</span>
                          </button>
                        )}
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
              aria-labelledby="user-master-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <form className="form" onSubmit={submit}>
                <div className="panel-head">
                  <h2 id="user-master-title">{draft.id ? "Ubah pengguna" : "Tambah pengguna"}</h2>
                </div>
                <div className="form-grid">
                  <label>
                    Username
                    <input
                      value={draft.username}
                      autoComplete="off"
                      onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Nama
                    <input
                      value={draft.name}
                      autoComplete="off"
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Level
                    <select
                      value={draft.level}
                      disabled={editingSelf}
                      onChange={(event) => setDraft({ ...draft, level: event.target.value })}
                    >
                      {USER_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {LEVEL_LABEL[level]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={draft.active}
                      disabled={editingSelf}
                      onChange={(event) => setDraft({ ...draft, active: event.target.value === "1" ? "1" : "0" })}
                    >
                      <option value="1">Aktif</option>
                      <option value="0">Nonaktif</option>
                    </select>
                  </label>
                  <label className="form-span">
                    Password
                    <input
                      type="password"
                      value={draft.password}
                      autoComplete="new-password"
                      placeholder={draft.id ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"}
                      onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                      required={!draft.id}
                      minLength={draft.id ? undefined : 8}
                    />
                  </label>
                </div>
                {editingSelf ? <p className="unit-select-meta">Akun yang sedang dipakai tetap superuser aktif.</p> : null}
                {error ? <div className="error">{error}</div> : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saveMutation.isPending || unchanged}>
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
