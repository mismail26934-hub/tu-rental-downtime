import type { RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import type { SummaryEvent } from "@/lib/summary";

type EventRow = RowDataPacket & {
  unit: string | null;
  sheet_date: string | null;
  waiting_labour_at: string | null;
  repair_started_at: string | null;
  rd30_at: string | null;
};

export async function listSummaryEvents(): Promise<SummaryEvent[]> {
  const [rows] = await getPool().query<EventRow[]>(
    `SELECT r.unit, r.waiting_labour_at, r.repair_started_at, r.rd30_at, s.sheet_date
     FROM handover_rows r
     INNER JOIN handover_sheets s ON s.id = r.sheet_id`
  );
  return rows.map((row) => ({
    unit: String(row.unit || ""),
    sheetDate: String(row.sheet_date || "").slice(0, 10),
    waiting_labour_at: String(row.waiting_labour_at || ""),
    repair_started_at: String(row.repair_started_at || ""),
    rd30_at: String(row.rd30_at || ""),
  }));
}
