import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { recordBackup, type BackupActor } from "@/db/backup";
import { getPool } from "@/db/pool";
import type { BoardData, HandoverRow, HandoverSheet, RowInput, Shift } from "@/lib/types";

type SheetPacket = RowDataPacket & HandoverSheet;
type RowPacket = RowDataPacket & HandoverRow;

const ROW_FIELDS: (keyof RowInput)[] = [
  "crew",
  "unit",
  "location",
  "technician",
  "status",
  "waiting_labour_at",
  "repair_started_at",
  "rd30_at",
  "hm_awal",
  "hm_akhir",
  "unit_backup",
  "backup_time",
  "breakdown_problem",
  "done_action",
  "continue_handover",
  "so",
];

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function mapSheet(row: SheetPacket): HandoverSheet {
  return {
    id: text(row.id),
    sheet_date: text(row.sheet_date).slice(0, 10),
    shift: text(row.shift) === "DS" ? "DS" : "NS",
    created_by: text(row.created_by),
    created_at: text(row.created_at),
  };
}

function mapRow(row: RowPacket): HandoverRow {
  return {
    id: text(row.id),
    sheet_id: text(row.sheet_id),
    sort_order: Number(row.sort_order) || 0,
    crew: text(row.crew),
    unit: text(row.unit),
    location: text(row.location),
    technician: text(row.technician),
    status: text(row.status),
    waiting_labour_at: text(row.waiting_labour_at),
    repair_started_at: text(row.repair_started_at),
    rd30_at: text(row.rd30_at),
    hm_awal: text(row.hm_awal),
    hm_akhir: text(row.hm_akhir),
    unit_backup: text(row.unit_backup),
    backup_time: text(row.backup_time),
    breakdown_problem: text(row.breakdown_problem),
    done_action: text(row.done_action),
    continue_handover: text(row.continue_handover),
    so: text(row.so),
    updated_at: text(row.updated_at),
    updated_by: text(row.updated_by),
  };
}

export async function getBoard(date: string, shift: Shift): Promise<BoardData> {
  const pool = getPool();
  const [sheets] = await pool.query<SheetPacket[]>(
    "SELECT * FROM handover_sheets WHERE sheet_date = ? AND shift = ? LIMIT 1",
    [date, shift]
  );
  const sheet = sheets[0] ? mapSheet(sheets[0]) : null;
  if (!sheet) return { sheet: null, rows: [] };
  const [rows] = await pool.query<RowPacket[]>(
    "SELECT * FROM handover_rows WHERE sheet_id = ? ORDER BY sort_order ASC, unit ASC",
    [sheet.id]
  );
  return { sheet, rows: rows.map(mapRow) };
}

export async function listSheetYears(): Promise<number[]> {
  const [yearRows] = await getPool().query<RowDataPacket[]>(
    "SELECT DISTINCT LEFT(sheet_date, 4) AS y FROM handover_sheets WHERE sheet_date <> '' ORDER BY y DESC"
  );
  return yearRows
    .map((row) => Number(row.y))
    .filter((value) => Number.isInteger(value) && value >= 2000);
}

export async function getBoardYear(year: string): Promise<{ rows: HandoverRow[]; years: number[] }> {
  const pool = getPool();
  const [rows] = await pool.query<RowPacket[]>(
    `SELECT r.*
     FROM handover_rows r
     INNER JOIN handover_sheets s ON s.id = r.sheet_id
     WHERE s.sheet_date >= ? AND s.sheet_date <= ?
     ORDER BY s.sheet_date ASC, s.shift ASC, r.sort_order ASC, r.unit ASC`,
    [`${year}-01-01`, `${year}-12-31`]
  );
  return { rows: rows.map(mapRow), years: await listSheetYears() };
}

async function readRow(id: string, conn?: PoolConnection, lock = false): Promise<HandoverRow | null> {
  const db = conn ?? getPool();
  const [rows] = await db.query<RowPacket[]>(
    `SELECT * FROM handover_rows WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

async function readSheet(id: string): Promise<HandoverSheet | null> {
  const pool = getPool();
  const [rows] = await pool.query<SheetPacket[]>(
    "SELECT * FROM handover_sheets WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ? mapSheet(rows[0]) : null;
}

export async function saveRow(input: {
  sheet: { id: string; sheet_date: string; shift: Shift };
  row: RowInput & { id: string };
  actor: BackupActor;
}): Promise<{ sheet: HandoverSheet; row: HandoverRow }> {
  const pool = getPool();
  const conn = await pool.getConnection();
  const now = new Date().toISOString();
  let sheetId = input.sheet.id;
  try {
    await conn.beginTransaction();
    const [existingSheets] = await conn.query<SheetPacket[]>(
      "SELECT * FROM handover_sheets WHERE sheet_date = ? AND shift = ? LIMIT 1",
      [input.sheet.sheet_date, input.sheet.shift]
    );
    if (existingSheets[0]) {
      sheetId = text(existingSheets[0].id);
    } else {
      await conn.query(
        `INSERT INTO handover_sheets (id, sheet_date, shift, created_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [input.sheet.id, input.sheet.sheet_date, input.sheet.shift, input.actor.id, now]
      );
      sheetId = input.sheet.id;
    }

    const [found] = await conn.query<RowPacket[]>(
      "SELECT * FROM handover_rows WHERE id = ? LIMIT 1 FOR UPDATE",
      [input.row.id]
    );
    const values = ROW_FIELDS.map((key) => input.row[key]);
    if (found[0]) {
      const previous = mapRow(found[0]);
      await recordBackup(
        {
          action: "ubah",
          entity: "handover_row",
          recordId: previous.id,
          label: previous.unit,
          snapshot: previous,
          actor: input.actor,
        },
        conn
      );
      await conn.query(
        `UPDATE handover_rows SET
          sheet_id = ?, crew = ?, unit = ?, location = ?, technician = ?, status = ?,
          waiting_labour_at = ?, repair_started_at = ?, rd30_at = ?, hm_awal = ?,
          hm_akhir = ?, unit_backup = ?, backup_time = ?, breakdown_problem = ?, done_action = ?, continue_handover = ?, so = ?,
          updated_at = ?, updated_by = ?
         WHERE id = ?`,
        [sheetId, ...values, now, input.actor.id, input.row.id]
      );
    } else {
      const [maxRows] = await conn.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM handover_rows WHERE sheet_id = ?",
        [sheetId]
      );
      const sortOrder = Number(maxRows[0]?.max_order || 0) + 1;
      await conn.query(
        `INSERT INTO handover_rows (
          id, sheet_id, sort_order, crew, unit, location, technician, status,
          waiting_labour_at, repair_started_at, rd30_at, hm_awal, hm_akhir,
          unit_backup, backup_time, breakdown_problem, done_action, continue_handover, so, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.row.id, sheetId, sortOrder, ...values, now, input.actor.id]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const sheet = await readSheet(sheetId);
  const row = await readRow(input.row.id);
  if (!sheet || !row) throw new Error("Gagal membaca data yang baru disimpan");
  return { sheet, row };
}

export async function updateRow(id: string, input: RowInput, actor: BackupActor): Promise<HandoverRow | null> {
  const conn = await getPool().getConnection();
  const now = new Date().toISOString();
  const values = ROW_FIELDS.map((key) => input[key]);
  try {
    await conn.beginTransaction();
    const previous = await readRow(id, conn, true);
    if (!previous) {
      await conn.rollback();
      return null;
    }
    await recordBackup(
      {
        action: "ubah",
        entity: "handover_row",
        recordId: previous.id,
        label: previous.unit,
        snapshot: previous,
        actor,
      },
      conn
    );
    await conn.query(
      `UPDATE handover_rows SET
        crew = ?, unit = ?, location = ?, technician = ?, status = ?,
        waiting_labour_at = ?, repair_started_at = ?, rd30_at = ?, hm_awal = ?,
        hm_akhir = ?, unit_backup = ?, backup_time = ?, breakdown_problem = ?, done_action = ?, continue_handover = ?, so = ?,
        updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [...values, now, actor.id, id]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return readRow(id);
}

export async function deleteRow(id: string, actor: BackupActor): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const previous = await readRow(id, conn, true);
    if (!previous) {
      await conn.rollback();
      return false;
    }
    await recordBackup(
      {
        action: "hapus",
        entity: "handover_row",
        recordId: previous.id,
        label: previous.unit,
        snapshot: previous,
        actor,
      },
      conn
    );
    const [result] = await conn.query<ResultSetHeader>("DELETE FROM handover_rows WHERE id = ?", [id]);
    if (!result.affectedRows) {
      await conn.rollback();
      return false;
    }
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
