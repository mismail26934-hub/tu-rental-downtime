import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { recordBackup, type BackupActor } from "@/db/backup";
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

export async function updateGroup(id: string, input: UnitGroupInput, actor: BackupActor): Promise<UnitGroup | null> {
  const conn = await getPool().getConnection();
  const now = new Date().toISOString();
  try {
    await conn.beginTransaction();
    const [current] = await conn.query<RowDataPacket[]>(
      "SELECT id, group_name, quota_hrs, created_at, updated_at FROM unit_groups WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!current[0]) {
      await conn.rollback();
      return null;
    }
    const previousName = String(current[0].group_name || "");
    await recordBackup(
      {
        action: "ubah",
        entity: "group",
        recordId: id,
        label: previousName,
        snapshot: current[0],
        actor,
      },
      conn
    );
    await conn.query("UPDATE unit_groups SET group_name = ?, quota_hrs = ?, updated_at = ? WHERE id = ?", [
      input.group,
      input.quota_hrs,
      now,
      id,
    ]);
    if (previousName !== input.group) {
      await conn.query("UPDATE units SET group_name = ?, updated_at = ? WHERE group_name = ?", [
        input.group,
        now,
        previousName,
      ]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
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

export async function deleteGroup(id: string, actor: BackupActor): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [current] = await conn.query<RowDataPacket[]>(
      "SELECT id, group_name, quota_hrs, created_at, updated_at FROM unit_groups WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!current[0]) {
      await conn.rollback();
      return false;
    }
    await recordBackup(
      {
        action: "hapus",
        entity: "group",
        recordId: id,
        label: String(current[0].group_name || ""),
        snapshot: current[0],
        actor,
      },
      conn
    );
    const [result] = await conn.query<ResultSetHeader>("DELETE FROM unit_groups WHERE id = ?", [id]);
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

export function isDuplicateGroupError(error: unknown): boolean {
  return typeof error === "object" && error != null && "errno" in error && (error as { errno?: number }).errno === 1062;
}
