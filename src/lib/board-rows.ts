import { computeMetrics } from "@/lib/calc";
import { formatDt, formatHours, formatStamp } from "@/lib/format";
import type { HandoverRow, Metrics } from "@/lib/types";

export type ListedRow = {
  row: HandoverRow;
  number: number;
  metrics: Metrics;
};

function rowMatches(row: HandoverRow, metrics: Metrics, needle: string): boolean {
  const haystack = [
    row.crew,
    row.unit,
    row.location,
    row.technician,
    row.status,
    row.hm_awal,
    row.hm_akhir,
    row.breakdown_problem,
    row.done_action,
    row.continue_handover,
    formatStamp(row.waiting_labour_at),
    formatStamp(row.repair_started_at),
    formatStamp(row.rd30_at),
    formatHours(metrics.erdm),
    formatHours(metrics.waitingLabourHours),
    formatHours(metrics.repairHours),
    formatDt(metrics.dtLabel, metrics.dtTotal),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

export function visibleHandoverRows(rows: HandoverRow[], now: Date, query: string): ListedRow[] {
  const needle = query.trim().toLowerCase();
  return rows
    .map((row, index) => ({ row, number: index + 1, metrics: computeMetrics(row, now) }))
    .filter(({ row, metrics }) => !needle || rowMatches(row, metrics, needle));
}
