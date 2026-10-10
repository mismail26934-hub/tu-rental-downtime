"use client";

import { formatDt, formatHours, formatStamp } from "@/lib/format";
import { visibleHandoverRows } from "@/lib/board-rows";
import type { HandoverRow } from "@/lib/types";

type Props = {
  rows: HandoverRow[];
  now: Date;
  query: string;
  selectedId: string | null;
  frozen: boolean;
  onEdit: (row: HandoverRow) => void;
  onDelete: (row: HandoverRow) => void;
};

export function HandoverTable({ rows, now, query, selectedId, frozen, onEdit, onDelete }: Props) {
  const needle = query.trim().toLowerCase();
  const listed = visibleHandoverRows(rows, now, query);

  return (
    <div className="handover-table-wrap">
      <table className={`handover-table${frozen ? " is-frozen" : ""}`}>
        <thead>
          <tr>
            <th className="col-no col-pin col-pin-1" rowSpan={2}>#</th>
            <th className="col-pin col-pin-2" rowSpan={2}>Crew</th>
            <th className="col-pin col-pin-3" rowSpan={2}>Unit</th>
            <th rowSpan={2}>Location</th>
            <th rowSpan={2}>Technician</th>
            <th rowSpan={2}>Status</th>
            <th className="col-group" colSpan={3}>Time</th>
            <th className="col-group" colSpan={3}>Hours Meter (HM)</th>
            <th className="col-group" colSpan={3}>Remark</th>
            <th className="col-group" colSpan={3}>Output Time</th>
            <th rowSpan={2}>Aksi</th>
          </tr>
          <tr>
            <th>Waiting Labour</th>
            <th>Repair Time</th>
            <th>RD30</th>
            <th className="col-num">HM awal</th>
            <th className="col-num">HM akhir</th>
            <th className="col-num">ERDM</th>
            <th className="col-text">Breakdown problem</th>
            <th className="col-text">Done / Action</th>
            <th className="col-text">Continue / Handover</th>
            <th className="col-num">Waiting Labour</th>
            <th className="col-num">Repair time</th>
            <th className="col-num">DT Total</th>
          </tr>
        </thead>
        <tbody>
          {listed.length === 0 ? (
            <tr>
              <td className="handover-empty" colSpan={19}>
                {needle ? "Tidak ada data yang cocok." : "Belum ada unit pada shift ini."}
              </td>
            </tr>
          ) : (
            listed.map(({ row, number, metrics }) => {
              return (
                <tr key={row.id} className={row.id === selectedId ? "is-selected" : undefined}>
                  <td className="col-no col-pin col-pin-1">{number}</td>
                  <td className="col-pin col-pin-2">{row.crew || "—"}</td>
                  <td className="col-pin col-pin-3">{row.unit}</td>
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
                  <td className="col-num">{formatHours(metrics.waitingLabourHours)}</td>
                  <td className="col-num">{formatHours(metrics.repairHours)}</td>
                  <td className="col-num">{formatDt(metrics.dtLabel, metrics.dtTotal)}</td>
                  <td className="col-act">
                    <button className="btn btn-sm" type="button" onClick={() => onEdit(row)}>
                      Ubah
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      type="button"
                      onClick={() => onDelete(row)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
