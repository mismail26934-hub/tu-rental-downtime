import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import type { UnitGroup, UnitGroupInput } from "@/lib/groups";

type GroupRow = RowDataPacket & {
  id: string;
  group_name: string;
  quota_hrs: string | number;
};

type CountRow = RowDataPacket & { total: number };

function mapGroup(row: GroupRow): UnitGroup {
  return {
    id: row.id,
    group: row.group_name,
    quota_hrs: Number(row.quota_hrs),
  };
}

export async function listGroups(): Promise<UnitGroup[]> {
  const [rows] = await getPool().query<GroupRow[]>(
    "SELECT id, group_name, quota_hrs FROM unit_groups ORDER BY group_name ASC"
  );
  return rows.map(mapGroup);
}

export async function findGroupByName(group: string): Promise<UnitGroup | null> {
  const [rows] = await getPool().query<GroupRow[]>(
    "SELECT id, group_name, quota_hrs FROM unit_groups WHERE group_name = ? LIMIT 1",
    [group.trim()]
  );
  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function insertGroup(id: string, input: UnitGroupInput): Promise<UnitGroup> {
  const now = new Date().toISOString();
  await getPool().query(
    "INSERT INTO unit_groups (id, group_name, quota_hrs, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.group, input.quota_hrs, now, now]
  );
  return { id, ...input };
}

export async function updateGroup(id: string, input: UnitGroupInput): Promise<UnitGroup | null> {
  const [current] = await getPool().query<GroupRow[]>(
    "SELECT id, group_name, quota_hrs FROM unit_groups WHERE id = ? LIMIT 1",
    [id]
  );
  if (!current[0]) return null;
  const previous = current[0].group_name;
  const now = new Date().toISOString();
  const [result] = await getPool().query<ResultSetHeader>(
    "UPDATE unit_groups SET group_name = ?, quota_hrs = ?, updated_at = ? WHERE id = ?",
    [input.group, input.quota_hrs, now, id]
  );
  if (!result.affectedRows) return null;
  if (previous !== input.group) {
    await getPool().query("UPDATE units SET group_name = ?, updated_at = ? WHERE group_name = ?", [
      input.group,
      now,
      previous,
    ]);
  }
  return { id, ...input };
}

export async function countUnitsInGroup(group: string): Promise<number> {
  const [rows] = await getPool().query<CountRow[]>(
    "SELECT COUNT(*) AS total FROM units WHERE group_name = ?",
    [group.trim()]
  );
  return Number(rows[0]?.total || 0);
}

export async function deleteGroup(id: string): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>("DELETE FROM unit_groups WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export function isDuplicateGroupError(error: unknown): boolean {
  return typeof error === "object" && error != null && "errno" in error && (error as { errno?: number }).errno === 1062;
}
