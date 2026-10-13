import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import { CARD_FIELDS, type CardFieldState } from "@/lib/model-card-fields";
import type { SummaryUnit } from "@/lib/summary-view";

const ROW_ID = "model-summary";

export type WaSchedule = {
  enabled: boolean;
  intervalMinutes: number;
  activeFrom: string;
  activeUntil: string;
  mode: SummaryUnit;
  year: string;
  fields: CardFieldState;
  nextRunAt: string;
  lastRunAt: string;
  lastError: string;
};

type ScheduleRow = RowDataPacket & {
  enabled: number;
  interval_minutes: number;
  active_from: string;
  active_until: string;
  mode: string;
  year: string;
  fields_json: string;
  next_run_at: string;
  last_run_at: string;
  last_error: string;
};

let ready: Promise<void> | null = null;

export function ensureWaSchedule(): Promise<void> {
  if (!ready) {
    ready = createTable().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function createTable(): Promise<void> {
  const db = getPool();
  await db.query(`CREATE TABLE IF NOT EXISTS wa_model_schedule (
    id                VARCHAR(64)  NOT NULL PRIMARY KEY,
    enabled           TINYINT(1)   NOT NULL DEFAULT 0,
    interval_minutes  INT          NOT NULL DEFAULT 60,
    active_from       CHAR(5)      NOT NULL DEFAULT '06:00',
    active_until      CHAR(5)      NOT NULL DEFAULT '22:00',
    mode              VARCHAR(8)   NOT NULL DEFAULT 'jam',
    year              CHAR(4)      NOT NULL DEFAULT '',
    fields_json       TEXT         NOT NULL,
    next_run_at       VARCHAR(32)  NOT NULL DEFAULT '',
    last_run_at       VARCHAR(32)  NOT NULL DEFAULT '',
    last_error        VARCHAR(255) NOT NULL DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(
    `INSERT IGNORE INTO wa_model_schedule
      (id, enabled, interval_minutes, active_from, active_until, mode, year, fields_json, next_run_at, last_run_at, last_error)
     VALUES (?, 0, 60, '06:00', '22:00', 'jam', '', '{}', '', '', '')`,
    [ROW_ID]
  );
}

export async function readWaSchedule(): Promise<WaSchedule> {
  await ensureWaSchedule();
  const [rows] = await getPool().query<ScheduleRow[]>(
    `SELECT enabled, interval_minutes, active_from, active_until, mode, year, fields_json, next_run_at, last_run_at, last_error
     FROM wa_model_schedule WHERE id = ? LIMIT 1`,
    [ROW_ID]
  );
  return mapSchedule(rows[0]);
}

export async function writeWaSchedule(schedule: WaSchedule): Promise<void> {
  await ensureWaSchedule();
  await getPool().query(
    `UPDATE wa_model_schedule
     SET enabled = ?, interval_minutes = ?, active_from = ?, active_until = ?, mode = ?, year = ?, fields_json = ?, next_run_at = ?, last_run_at = ?, last_error = ?
     WHERE id = ?`,
    [
      schedule.enabled ? 1 : 0,
      schedule.intervalMinutes,
      schedule.activeFrom,
      schedule.activeUntil,
      schedule.mode,
      schedule.year,
      JSON.stringify(schedule.fields),
      schedule.nextRunAt,
      schedule.lastRunAt,
      schedule.lastError.slice(0, 255),
      ROW_ID,
    ]
  );
}

export async function claimWaRun(expectedNext: string, nextRunAt: string, lastRunAt: string): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>(
    `UPDATE wa_model_schedule
     SET next_run_at = ?, last_run_at = ?, last_error = ''
     WHERE id = ? AND enabled = 1 AND next_run_at = ?`,
    [nextRunAt, lastRunAt, ROW_ID, expectedNext]
  );
  return result.affectedRows === 1;
}

export async function setWaScheduleNext(nextRunAt: string, lastError = ""): Promise<void> {
  await getPool().query(
    `UPDATE wa_model_schedule SET next_run_at = ?, last_error = ? WHERE id = ?`,
    [nextRunAt, lastError.slice(0, 255), ROW_ID]
  );
}

function mapSchedule(row: ScheduleRow | undefined): WaSchedule {
  const fields = {} as CardFieldState;
  const parsed = parseFields(row?.fields_json || "");
  for (const field of CARD_FIELDS) fields[field] = parsed?.[field] !== false;
  return {
    enabled: Boolean(row?.enabled),
    intervalMinutes: Number(row?.interval_minutes) || 60,
    activeFrom: row?.active_from || "06:00",
    activeUntil: row?.active_until || "22:00",
    mode: row?.mode === "hari" ? "hari" : "jam",
    year: row?.year || "",
    fields,
    nextRunAt: row?.next_run_at || "",
    lastRunAt: row?.last_run_at || "",
    lastError: row?.last_error || "",
  };
}

function parseFields(value: string): Partial<CardFieldState> | null {
  try {
    const parsed = JSON.parse(value) as Partial<CardFieldState>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
