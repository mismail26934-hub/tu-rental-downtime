import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { recordBackup, type BackupActor } from "@/db/backup";
import { getPool } from "@/db/pool";
import type { UnitModel, UnitModelInput } from "@/lib/models";

type ModelRow = RowDataPacket & {
  id: string;
  model_name: string;
};

type CountRow = RowDataPacket & { total: number };
type DistinctRow = RowDataPacket & { model: string };

function mapModel(row: ModelRow): UnitModel {
  return {
    id: row.id,
    model: row.model_name,
  };
}

export async function listModels(): Promise<UnitModel[]> {
  const [rows] = await getPool().query<ModelRow[]>(
    "SELECT id, model_name FROM unit_models ORDER BY model_name ASC"
  );
  return rows.map(mapModel);
}

export async function findModelByName(model: string): Promise<UnitModel | null> {
  const [rows] = await getPool().query<ModelRow[]>(
    "SELECT id, model_name FROM unit_models WHERE model_name = ? LIMIT 1",
    [model.trim()]
  );
  return rows[0] ? mapModel(rows[0]) : null;
}

export async function ensureModelsFromUnits(): Promise<void> {
  const [rows] = await getPool().query<DistinctRow[]>(
    `SELECT DISTINCT u.model AS model
     FROM units u
     LEFT JOIN unit_models m ON m.model_name = u.model
     WHERE TRIM(u.model) <> '' AND m.id IS NULL`
  );
  if (!rows.length) return;
  const now = new Date().toISOString();
  for (const row of rows) {
    const model = String(row.model || "").trim();
    if (!model) continue;
    try {
      await getPool().query(
        "INSERT INTO unit_models (id, model_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [crypto.randomUUID(), model, now, now]
      );
    } catch (error) {
      if (!isDuplicateModelError(error)) throw error;
    }
  }
}

export async function insertModel(id: string, input: UnitModelInput): Promise<UnitModel> {
  const now = new Date().toISOString();
  await getPool().query(
    "INSERT INTO unit_models (id, model_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [id, input.model, now, now]
  );
  return { id, ...input };
}

export async function updateModel(id: string, input: UnitModelInput, actor: BackupActor): Promise<UnitModel | null> {
  const conn = await getPool().getConnection();
  const now = new Date().toISOString();
  try {
    await conn.beginTransaction();
    const [current] = await conn.query<RowDataPacket[]>(
      "SELECT id, model_name, created_at, updated_at FROM unit_models WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!current[0]) {
      await conn.rollback();
      return null;
    }
    const previousName = String(current[0].model_name || "");
    await recordBackup(
      {
        action: "ubah",
        entity: "model",
        recordId: id,
        label: previousName,
        snapshot: current[0],
        actor,
      },
      conn
    );
    await conn.query("UPDATE unit_models SET model_name = ?, updated_at = ? WHERE id = ?", [
      input.model,
      now,
      id,
    ]);
    if (previousName !== input.model) {
      await conn.query("UPDATE units SET model = ?, updated_at = ? WHERE model = ?", [
        input.model,
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

export async function countUnitsWithModel(model: string): Promise<number> {
  const [rows] = await getPool().query<CountRow[]>(
    "SELECT COUNT(*) AS total FROM units WHERE model = ?",
    [model.trim()]
  );
  return Number(rows[0]?.total || 0);
}

export async function deleteModel(id: string, actor: BackupActor): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [current] = await conn.query<RowDataPacket[]>(
      "SELECT id, model_name, created_at, updated_at FROM unit_models WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!current[0]) {
      await conn.rollback();
      return false;
    }
    await recordBackup(
      {
        action: "hapus",
        entity: "model",
        recordId: id,
        label: String(current[0].model_name || ""),
        snapshot: current[0],
        actor,
      },
      conn
    );
    const [result] = await conn.query<ResultSetHeader>("DELETE FROM unit_models WHERE id = ?", [id]);
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

export function isDuplicateModelError(error: unknown): boolean {
  return typeof error === "object" && error != null && "errno" in error && (error as { errno?: number }).errno === 1062;
}
