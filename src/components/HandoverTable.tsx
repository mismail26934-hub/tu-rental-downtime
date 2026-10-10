"use client";

import { useState } from "react";
import { SisaValue } from "@/components/SisaValue";
import { parseHm, parseLocal } from "@/lib/calc";
import { formatDt, formatHours, formatStamp } from "@/lib/format";
import { visibleHandoverRows, type ListedRow } from "@/lib/board-rows";
import { SISA_LABELS, type SisaCell } from "@/lib/unit-sisa";
import type { HandoverRow } from "@/lib/types";

type SortKey =
  | "no"
  | "crew"
  | "unit"
  | "location"
  | "technician"
  | "status"
  | "waiting"
  | "repair"
  | "rd30"
  | "hmAwal"
  | "hmAkhir"
  | "erdm"
  | "problem"
  | "done"
  | "handover"
  | "so"
  | "waitHours"
  | "repairHours"
  | "dt"
  | "sisa";

type SortDir = "asc" | "desc";

type SortState = { key: SortKey; dir: SortDir; sisaIndex?: number };

type Props = {
  rows: HandoverRow[];
  now: Date;
  query: string;
  selectedId: string | null;
  frozen: boolean;
  editable?: boolean;
  emptyText?: string;
  sisa?: Map<string, SisaCell[]>;
  onEdit: (row: HandoverRow) => void;
  onDelete: (row: HandoverRow) => void;
};

export function HandoverTable({
  rows,
  now,
  query,
  selectedId,
  frozen,
  editable = false,
  emptyText,
  sisa,
  onEdit,
  onDelete,
}: Props) {
  const needle = query.trim().toLowerCase();
  const [sort, setSort] = useState<SortState>({ key: "dt", dir: "desc" });
  const listed = sortRows(visibleHandoverRows(rows, now, query), sort, sisa);
  const columnCount = editable ? 26 : 25;

  function toggleSort(key: SortKey, sisaIndex?: number) {
    setSort((current) => {
      if (current.key === key && current.sisaIndex === sisaIndex) {
        return { key, sisaIndex, dir: current.dir === "asc" ? "desc" : "asc" };
      }
      return { key, sisaIndex, dir: defaultDir(key) };
    });
  }

  return (
    <div className="handover-table-wrap">
      <table className={`handover-table${frozen ? " is-frozen" : ""}`}>
        <thead>
          <tr>
            <SortTh className="col-no col-pin col-pin-1" rowSpan={2} label="#" sortKey="no" sort={sort} onSort={toggleSort} />
            <SortTh className="col-pin col-pin-2" rowSpan={2} label="Crew" sortKey="crew" sort={sort} onSort={toggleSort} />
            <SortTh className="col-pin col-pin-3" rowSpan={2} label="Unit" sortKey="unit" sort={sort} onSort={toggleSort} />
            <SortTh rowSpan={2} label="Location" sortKey="location" sort={sort} onSort={toggleSort} />
            <SortTh rowSpan={2} label="Technician" sortKey="technician" sort={sort} onSort={toggleSort} />
            <SortTh rowSpan={2} label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
            <th className="col-group" colSpan={3}>Time</th>
            <th className="col-group" colSpan={3}>Hours Meter (HM)</th>
            <th className="col-group" colSpan={3}>Remark</th>
            <SortTh rowSpan={2} label="SO" sortKey="so" sort={sort} onSort={toggleSort} />
            <th className="col-group" colSpan={3}>Output Time</th>
            <th className="col-group" colSpan={SISA_LABELS.length}>Sisa Quota Hrs</th>
            {editable ? <th rowSpan={2}>Aksi</th> : null}
          </tr>
          <tr>
            <SortTh label="Waiting Labour" sortKey="waiting" sort={sort} onSort={toggleSort} />
            <SortTh label="Repair Time" sortKey="repair" sort={sort} onSort={toggleSort} />
            <SortTh label="RD30" sortKey="rd30" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="HM awal" sortKey="hmAwal" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="HM akhir" sortKey="hmAkhir" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="ERDM" sortKey="erdm" sort={sort} onSort={toggleSort} />
            <SortTh className="col-text" label="Breakdown problem" sortKey="problem" sort={sort} onSort={toggleSort} />
            <SortTh className="col-text" label="Done / Action" sortKey="done" sort={sort} onSort={toggleSort} />
            <SortTh className="col-text" label="Continue / Handover" sortKey="handover" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="Waiting Labour" sortKey="waitHours" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="Repair time" sortKey="repairHours" sort={sort} onSort={toggleSort} />
            <SortTh className="col-num" label="DT Total" sortKey="dt" sort={sort} onSort={toggleSort} />
            {SISA_LABELS.map((label, index) => (
              <SortTh
                key={label}
                className="col-num"
                label={label}
                sortKey="sisa"
                sisaIndex={index}
                sort={sort}
                onSort={toggleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {listed.length === 0 ? (
            <tr>
              <td className="handover-empty" colSpan={columnCount}>
                {needle ? "Tidak ada data yang cocok." : emptyText || "Belum ada unit pada shift ini."}
              </td>
            </tr>
          ) : (
            listed.map(({ row, number, metrics }) => {
              const cells = sisa?.get(row.unit.trim().toLowerCase());
              return (
                <tr key={row.id} className={row.id === selectedId ? "is-selected" : undefined}>
                  <td className="col-no col-pin col-pin-1">{number}</td>
                  <td className="col-pin col-pin-2">{row.crew || "—"}</td>
                  <td className="col-pin col-pin-3">
                    {metrics.dtLabel === "N/Y Ready" ? <span className="is-ny">{row.unit}*</span> : row.unit || "—"}
                  </td>
                  <td>{row.location || "—"}</td>
                  <td>{row.technician || "—"}</td>
                  <td>{row.status || "—"}</td>
                  <td>{formatStamp(row.waiting_labour_at)}</td>
                  <td>{formatStamp(row.repair_started_at)}</td>
                  <td>{formatStamp(row.rd30_at)}</td>
                  <td className="col-num">{row.hm_awal || "—"}</td>
                  <td className="col-num">{row.hm_akhir || "—"}</td>
                  <td className="col-num">{formatHours(metrics.erdm)}</td>
                  <td className="col-text">{row.breakdown_problem || "—"}</td>
                  <td className="col-text">{row.done_action || "—"}</td>
                  <td className="col-text">{row.continue_handover || "—"}</td>
                  <td className="col-text">{row.so || "—"}</td>
                  <td className="col-num">{formatHours(metrics.waitingLabourHours)}</td>
                  <td className="col-num">{formatHours(metrics.repairHours)}</td>
                  <td className="col-num">{formatDt(metrics.dtLabel, metrics.dtTotal)}</td>
                  {SISA_LABELS.map((label, index) => {
                    const cell = cells?.[index];
                    return (
                      <td key={label} className={cell?.left != null && cell.left < 0 ? "col-num is-over" : "col-num"}>
                        <SisaValue cell={cell} />
                      </td>
                    );
                  })}
                  {editable ? (
                    <td className="col-act">
                      <button className="btn btn-sm" type="button" onClick={() => onEdit(row)}>
                        Ubah
                      </button>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => onDelete(row)}>
                        Hapus
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortTh({
  label,
  sortKey,
  sisaIndex,
  sort,
  className,
  rowSpan,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sisaIndex?: number;
  sort: SortState;
  className?: string;
  rowSpan?: number;
  onSort: (key: SortKey, sisaIndex?: number) => void;
}) {
  const active = sort.key === sortKey && sort.sisaIndex === sisaIndex;
  return (
    <th className={className} rowSpan={rowSpan} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={active ? `sort-btn is-${sort.dir}` : "sort-btn"}
        type="button"
        onClick={() => onSort(sortKey, sisaIndex)}
      >
        {label}
        <span className="sort-mark" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function defaultDir(key: SortKey): SortDir {
  if (key === "no" || key === "crew" || key === "unit" || key === "location" || key === "technician" || key === "status") {
    return "asc";
  }
  if (key === "problem" || key === "done" || key === "handover" || key === "so") return "asc";
  return "desc";
}

function sortRows(rows: ListedRow[], sort: SortState, sisa?: Map<string, SisaCell[]>): ListedRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, sort, sisa) || a.number - b.number);
}

function compareRows(a: ListedRow, b: ListedRow, sort: SortState, sisa?: Map<string, SisaCell[]>): number {
  if (sort.key === "dt") return compareDt(a, b, sort.dir);
  if (sort.key === "sisa") {
    const left = (item: ListedRow) => sisa?.get(item.row.unit.trim().toLowerCase())?.[sort.sisaIndex ?? 0]?.left ?? null;
    return compareNumber(left(a), left(b), sort.dir);
  }
  const av = valueOf(a, sort.key);
  const bv = valueOf(b, sort.key);
  if (typeof av === "number" || typeof bv === "number" || av == null || bv == null) {
    return compareNumber(typeof av === "number" ? av : null, typeof bv === "number" ? bv : null, sort.dir);
  }
  return compareText(av, bv, sort.dir);
}

function valueOf(item: ListedRow, key: SortKey): string | number | null {
  const { row, metrics } = item;
  if (key === "no") return item.number;
  if (key === "crew") return row.crew;
  if (key === "unit") return row.unit;
  if (key === "location") return row.location;
  if (key === "technician") return row.technician;
  if (key === "status") return row.status;
  if (key === "waiting") return parseLocal(row.waiting_labour_at);
  if (key === "repair") return parseLocal(row.repair_started_at);
  if (key === "rd30") return parseLocal(row.rd30_at);
  if (key === "hmAwal") return parseHm(row.hm_awal);
  if (key === "hmAkhir") return parseHm(row.hm_akhir);
  if (key === "erdm") return metrics.erdm;
  if (key === "problem") return row.breakdown_problem;
  if (key === "done") return row.done_action;
  if (key === "handover") return row.continue_handover;
  if (key === "so") return row.so;
  if (key === "waitHours") return metrics.waitingLabourHours;
  if (key === "repairHours") return metrics.repairHours;
  return null;
}

function compareDt(a: ListedRow, b: ListedRow, dir: SortDir): number {
  return compareNumber(dtRank(a), dtRank(b), dir);
}

function dtRank(item: ListedRow): number | null {
  if (item.metrics.dtLabel === "N/Y Ready") return Number.POSITIVE_INFINITY;
  return item.metrics.dtTotal;
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
