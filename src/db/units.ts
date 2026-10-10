import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import type { UnitInput, UnitMaster } from "@/lib/units";

type UnitRow = RowDataPacket & {
  id: string;
  model: string;
  quota_hrs: string | number;
  unit_code: string;
  group_name: string | null;
  group_quota: string | number | null;
};

const UNIT_SELECT = `SELECT u.id, u.model, u.quota_hrs, u.unit_code, u.group_name, g.quota_hrs AS group_quota
  FROM units u
  LEFT JOIN unit_groups g ON g.group_name = u.group_name`;

function mapUnit(row: UnitRow): UnitMaster {
  return {
    id: row.id,
    model: row.model,
    quota_hrs: Number(row.quota_hrs),
    unit: row.unit_code,
    group: row.group_name || "",
    group_quota_hrs: row.group_quota == null || row.group_quota === "" ? null : Number(row.group_quota),
  };
}

async function quotaForGroup(group: string): Promise<number | null> {
  if (!group.trim()) return null;
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT quota_hrs FROM unit_groups WHERE group_name = ? LIMIT 1",
    [group.trim()]
  );
  const value = rows[0]?.quota_hrs;
  return value == null || value === "" ? null : Number(value);
}

export async function listUnits(): Promise<UnitMaster[]> {
  const [rows] = await getPool().query<UnitRow[]>(`${UNIT_SELECT} ORDER BY u.unit_code ASC, u.model ASC`);
  return rows.map(mapUnit);
}

export async function findUnitByCode(unit: string): Promise<UnitMaster | null> {
  const [rows] = await getPool().query<UnitRow[]>(`${UNIT_SELECT} WHERE u.unit_code = ? LIMIT 1`, [unit.trim()]);
  return rows[0] ? mapUnit(rows[0]) : null;
}

export async function insertUnit(id: string, input: UnitInput): Promise<UnitMaster> {
  const now = new Date().toISOString();
  await getPool().query(
    "INSERT INTO units (id, model, quota_hrs, unit_code, group_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, input.model, input.quota_hrs, input.unit, input.group, now, now]
  );
  return { id, ...input, group_quota_hrs: await quotaForGroup(input.group) };
}

export async function updateUnit(id: string, input: UnitInput): Promise<UnitMaster | null> {
  const [result] = await getPool().query<ResultSetHeader>(
    "UPDATE units SET model = ?, quota_hrs = ?, unit_code = ?, group_name = ?, updated_at = ? WHERE id = ?",
    [input.model, input.quota_hrs, input.unit, input.group, new Date().toISOString(), id]
  );
  if (!result.affectedRows) return null;
  return { id, ...input, group_quota_hrs: await quotaForGroup(input.group) };
}

export async function deleteUnit(id: string): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>("DELETE FROM units WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export function isDuplicateUnitError(error: unknown): boolean {
  return typeof error === "object" && error != null && "errno" in error && (error as { errno?: number }).errno === 1062;
}
