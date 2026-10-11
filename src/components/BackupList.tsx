"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { formatStamp } from "@/lib/format";

type BackupView = {
  id: string;
  action: "ubah" | "hapus";
  entity: "handover_row" | "unit" | "group";
  recordId: string;
  label: string;
  userName: string;
  username: string;
  actedAt: string;
  snapshot: Record<string, string>;
};

const ACTION_LABEL = { ubah: "Ubah", hapus: "Hapus" } as const;
const ENTITY_LABEL = {
  handover_row: "Daftar unit",
  unit: "Master unit",
  group: "Master group",
} as const;

const FIELD_LABELS: Record<string, string> = {
  crew: "Crew",
  unit: "Unit",
  unit_code: "Unit",
  model: "Model",
  location: "Location",
  technician: "Technician",
  status: "Status",
  waiting_labour_at: "Waiting Labour",
  repair_started_at: "Repair Time",
  rd30_at: "RD30",
  hm_awal: "HM awal",
  hm_akhir: "HM akhir",
  breakdown_problem: "Breakdown problem",
  done_action: "Done / Action",
  continue_handover: "Continue / Handover",
  so: "SO",
  quota_hrs: "Quota Hrs",
  group_name: "Group",
  group: "Group",
  created_at: "Dibuat",
  updated_at: "Diubah",
  updated_by: "Diubah oleh",
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);
const HIDDEN_FIELDS = new Set(["id", "sheet_id", "sort_order"]);
const TIME_FIELDS = new Set(["waiting_labour_at", "repair_started_at", "rd30_at", "created_at", "updated_at"]);
const PAGE_SIZE = 10;

async function fetchBackups(): Promise<BackupView[]> {
  const response = await fetch("/api/backups");
  if (!response.ok) throw new Error("Gagal memuat backup");
  const body = (await response.json()) as { backups?: BackupView[] };
  return body.backups || [];
}

function formatWhen(value: string): string {
  const shown = formatStamp(value);
  return shown === "—" ? value || "—" : shown;
}

function fieldValue(key: string, value: string): string {
  if (TIME_FIELDS.has(key)) return formatWhen(value);
  return value;
}

export function BackupList() {
  const backupsQuery = useQuery({
    queryKey: ["backups"],
    queryFn: fetchBackups,
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const backups = backupsQuery.data || [];
    if (!needle) return backups;
    return backups.filter((item) =>
      [
        ACTION_LABEL[item.action],
        ENTITY_LABEL[item.entity],
        item.label,
        item.userName,
        item.username,
        formatWhen(item.actedAt),
      ]
        .join("\n")
        .toLowerCase()
        .includes(needle)
    );
  }, [backupsQuery.data, search]);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function showPage(next: number) {
    setPage(next);
    setOpenId(null);
  }

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
    setOpenId(null);
  }

  return (
    <>
      <Topbar busy={backupsQuery.isFetching} onRefresh={() => void backupsQuery.refetch()} />
      <main className="app">
        <section className="panel">
          <div className="panel-head">
            <h2>BACKUP DATA</h2>
            <div className="panel-actions">
              <Link className="btn back-btn" href="/" aria-label="Kembali">
                <BackIcon />
                <span className="btn-label">Kembali</span>
              </Link>
              <div className="search-pair">
              <input
                className="unit-search"
                type="search"
                placeholder="Cari data atau pengguna"
                value={searchDraft}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchDraft(next);
                  if (!next.trim()) applySearch("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applySearch(searchDraft.trim());
                  }
                }}
              />
              <button className="btn" type="button" aria-label="Cari" onClick={() => applySearch(searchDraft.trim())}>
                <SearchIcon />
                <span className="btn-label">Cari</span>
              </button>
              </div>
            </div>
          </div>
          {backupsQuery.isError ? (
            <div className="error">
              {backupsQuery.error instanceof Error ? backupsQuery.error.message : "Gagal memuat data"}
            </div>
          ) : null}
          <div className="handover-table-wrap">
            <table className="handover-table master-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Jenis</th>
                  <th>Data</th>
                  <th>Pengguna</th>
                  <th>Isi</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      {backupsQuery.isSuccess ? (search ? "Tidak ada data yang cocok." : "Belum ada backup.") : "Memuat…"}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((item) => {
                    const open = openId === item.id;
                    const fields = Object.entries(item.snapshot)
                      .filter(([key]) => !HIDDEN_FIELDS.has(key))
                      .sort(([left], [right]) => {
                        const leftIndex = FIELD_ORDER.indexOf(left);
                        const rightIndex = FIELD_ORDER.indexOf(right);
                        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
                      });
                    return (
                      <Fragment key={item.id}>
                        <tr className={open ? "is-selected" : undefined}>
                          <td>{formatWhen(item.actedAt)}</td>
                          <td className={item.action === "hapus" ? "is-over" : undefined}>{ACTION_LABEL[item.action]}</td>
                          <td>{ENTITY_LABEL[item.entity]}</td>
                          <td>{item.label || "—"}</td>
                          <td>
                            <div className="backup-user">
                              {item.userName || item.username || "—"}
                              {item.username && item.username !== item.userName ? <small>{item.username}</small> : null}
                            </div>
                          </td>
                          <td className="col-act">
                            <button
                              className="btn btn-sm"
                              type="button"
                              aria-expanded={open}
                              onClick={() => setOpenId(open ? null : item.id)}
                            >
                              {open ? "Tutup" : "Lihat"}
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="backup-detail">
                            <td colSpan={6}>
                              {fields.length === 0 ? (
                                "Tidak ada isi data."
                              ) : (
                                <dl className="backup-fields">
                                  {fields.map(([key, value]) => (
                                    <div key={key}>
                                      <dt>{FIELD_LABELS[key] || key}</dt>
                                      <dd>{fieldValue(key, value)}</dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pager page={currentPage} totalPages={totalPages} onChange={showPage} />
        </section>
      </main>
    </>
  );
}

function getPagerItems(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const items: Array<number | "…"> = [];
  const pushUnique = (item: number | "…") => {
    if (items[items.length - 1] !== item) items.push(item);
  };
  pushUnique(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pushUnique("…");
  for (let index = start; index <= end; index += 1) pushUnique(index);
  if (end < total - 1) pushUnique("…");
  pushUnique(total);
  return items;
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const items = getPagerItems(page, totalPages);
  return (
    <nav className="pager" aria-label="Halaman backup">
      <button
        className="btn pager-nav"
        type="button"
        disabled={page <= 1}
        aria-label="Halaman sebelumnya"
        onClick={() => onChange(page - 1)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="pager-pages">
        {items.map((item, index) =>
          item === "…" ? (
            <span key={`ellipsis-${index}`} className="pager-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              className={item === page ? "btn pager-page is-active" : "btn pager-page"}
              type="button"
              aria-label={`Halaman ${item}`}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          )
        )}
      </div>
      <button
        className="btn pager-nav"
        type="button"
        disabled={page >= totalPages}
        aria-label="Halaman berikutnya"
        onClick={() => onChange(page + 1)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
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
