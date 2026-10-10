import type { Pool, PoolConnection } from "mysql2/promise";
import { getPool } from "@/db/pool";

export type BackupAction = "ubah" | "hapus";
export type BackupEntity = "handover_row" | "unit" | "group";

export type BackupActor = {
  id: string;
  name: string;
  username: string;
};

type Executor = Pool | PoolConnection;

export type BackupView = {
  id: string;
  action: BackupAction;
  entity: BackupEntity;
  recordId: string;
  label: string;
  userName: string;
  username: string;
  actedAt: string;
  snapshot: Record<string, string>;
};

type BackupPacket = {
  id: string;
  action: string;
  entity: string;
  record_id: string;
  record_label: string;
  snapshot: string;
  user_name: string;
  username: string;
  acted_at: string;
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function snapshotRecord(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const snapshot: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null || value === "") continue;
      snapshot[key] = text(value);
    }
    return snapshot;
  } catch {
    return {};
  }
}

export async function listBackups(limit = 300): Promise<BackupView[]> {
  const [rows] = await getPool().query(
    `SELECT id, action, entity, record_id, record_label, snapshot, user_name, username,
            DATE_FORMAT(acted_at, '%Y-%m-%d %H:%i:%s') AS acted_at
     FROM data_backups
     ORDER BY acted_at DESC, id DESC
     LIMIT ?`,
    [limit]
  );
  return (rows as BackupPacket[]).flatMap((row) => {
    const action = row.action === "hapus" ? "hapus" : row.action === "ubah" ? "ubah" : null;
    const entity = row.entity === "unit" || row.entity === "group" || row.entity === "handover_row" ? row.entity : null;
    if (!action || !entity) return [];
    return [{
      id: text(row.id),
      action,
      entity,
      recordId: text(row.record_id),
      label: text(row.record_label),
      userName: text(row.user_name),
      username: text(row.username),
      actedAt: text(row.acted_at),
      snapshot: snapshotRecord(text(row.snapshot)),
    }];
  });
}

export function actorFromUser(user: { id: string; name?: string | null; email?: string | null }): BackupActor {
  const username = user.email || "";
  return {
    id: user.id,
    name: user.name || username,
    username,
  };
}

export async function recordBackup(
  input: {
    action: BackupAction;
    entity: BackupEntity;
    recordId: string;
    label: string;
    snapshot: unknown;
    actor: BackupActor;
  },
  db: Executor = getPool()
): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO data_backups (
      id, action, entity, record_id, record_label, snapshot,
      user_id, user_name, username, acted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
    [
      id,
      input.action,
      input.entity,
      input.recordId,
      input.label.slice(0, 255),
      JSON.stringify(input.snapshot),
      input.actor.id,
      input.actor.name.slice(0, 255),
      input.actor.username.slice(0, 64),
    ]
  );
  return id;
}
