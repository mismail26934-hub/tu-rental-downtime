import type { Metrics, RowInput } from "@/lib/types";

export function parseLocal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value.trim()
  );
  if (!match) return null;
  const time = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  ).getTime();
  return Number.isFinite(time) ? time : null;
}

export function parseHm(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function asTime(value: string | Date): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  return parseLocal(value);
}

export function hoursBetween(start: string, end: string | Date): number | null {
  const from = parseLocal(start);
  const to = asTime(end);
  if (from == null || to == null) return null;
  return (to - from) / 3_600_000;
}

export function deriveStatus(
  input: Pick<RowInput, "waiting_labour_at" | "repair_started_at" | "rd30_at">
): "" | "RT" | "RD30" {
  if (input.rd30_at.trim()) return "RD30";
  if (input.waiting_labour_at.trim() || input.repair_started_at.trim()) return "RT";
  return "";
}

export function computeMetrics(
  input: Pick<
    RowInput,
    "waiting_labour_at" | "repair_started_at" | "rd30_at" | "hm_awal" | "hm_akhir"
  >,
  now: Date = new Date()
): Metrics {
  const hmAwal = parseHm(input.hm_awal);
  const hmAkhir = parseHm(input.hm_akhir);
  const erdm = hmAwal != null && hmAkhir != null ? hmAkhir - hmAwal : null;
  const waitingLabourHours = hoursBetween(
    input.waiting_labour_at,
    input.repair_started_at
  );
  const hasRd30 = input.rd30_at.trim().length > 0;
  const repairHours = hasRd30
    ? hoursBetween(input.repair_started_at, input.rd30_at)
    : hoursBetween(input.repair_started_at, now);

  let dtTotal: number | null = null;
  let dtLabel = "—";
  if (hasRd30) {
    if (waitingLabourHours != null || repairHours != null) {
      dtTotal = (waitingLabourHours ?? 0) + (repairHours ?? 0);
      dtLabel = "";
    }
  } else if (input.repair_started_at.trim()) {
    dtLabel = "N/Y Ready";
  }

  return { erdm, waitingLabourHours, repairHours, dtTotal, dtLabel };
}
