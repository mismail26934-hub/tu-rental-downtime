import { periodQuota, type PeriodKey, type SummaryRow } from "@/lib/summary";

export const SISA_PERIODS: PeriodKey[] = ["daily", "wtd", "mtd", "hytd1", "hytd2", "ytd"];

export const SISA_LABELS = ["Daily", "WTD", "MTD", "HYTD 1", "HYTD 2", "YTD"] as const;

export type SisaCell = { left: number | null; quota: number | null };

export type ModelGroup = SummaryRow & { members: SummaryRow[] };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sisaRemainder(quota: number | null, hours: number): number | null {
  if (quota == null || hours === 0) return null;
  return round2(quota - hours);
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function groupByModel(rows: SummaryRow[]): ModelGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, SummaryRow[]>();
  for (const row of rows) {
    const key = row.label.trim().toLowerCase();
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key)?.push(row);
  }
  return order.map((key) => {
    const members = buckets.get(key) || [];
    const first = members[0];
    const sharedQuota = members.every((row) => row.quota_hrs === first.quota_hrs) ? first.quota_hrs : null;
    const sum = (period: PeriodKey) => members.reduce((total, row) => round2(total + row[period]), 0);
    const daily = sum("daily");
    return {
      id: `model:${key}`,
      label: first.label,
      quota_hrs: sharedQuota,
      unit: members.map((row) => row.unit).join(","),
      daily,
      wtd: sum("wtd"),
      mtd: sum("mtd"),
      hytd1: sum("hytd1"),
      hytd2: sum("hytd2"),
      ytd: sum("ytd"),
      overDaily: sharedQuota != null && daily > sharedQuota,
      open: members.some((row) => row.open),
      backedUp: members.some((row) => row.backedUp),
      members,
    };
  });
}

function cellsFor(row: SummaryRow, asOf: string): SisaCell[] {
  const now = localDate(asOf);
  return SISA_PERIODS.map((period) => {
    if (period === "daily") return { left: sisaRemainder(row.quota_hrs, row.daily), quota: row.quota_hrs };
    const quota = periodQuota(row.quota_hrs, period, now);
    return { left: sisaRemainder(quota, row[period]), quota };
  });
}

/** Sisa yang tampil di summary. Unit dalam satu model memakai sisa modelnya. */
export function sisaByUnit(rows: SummaryRow[], asOf: string): Map<string, SisaCell[]> {
  const map = new Map<string, SisaCell[]>();
  if (!asOf) return map;
  for (const group of groupByModel(rows)) {
    const cells = cellsFor(group, asOf);
    for (const member of group.members) map.set(member.unit.trim().toLowerCase(), cells);
  }
  return map;
}
