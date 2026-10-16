import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import { hashPassword, needsPasswordHash, verifyPassword } from "@/lib/password";
import type { PublicUser } from "@/lib/types";

type UserRow = RowDataPacket & {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  email: string;
  phone: string;
  photo_name: string;
  level: string;
  active: number;
  created_at: string;
};

function toPublic(row: UserRow): PublicUser {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    photo_name: String(row.photo_name || ""),
    level: String(row.level || "teknisi"),
    active: Number(row.active) === 1 ? "1" : "0",
    created_at: String(row.created_at || ""),
  };
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<PublicUser | null> {
  const name = username.trim();
  if (!name || !password) return null;
  const pool = getPool();
  const [rows] = await pool.query<UserRow[]>(
    "SELECT * FROM users WHERE username = ? AND active = 1 LIMIT 1",
    [name]
  );
  const user = rows[0];
  if (!user) return null;
  const stored = String(user.password_hash || "");
  if (!(await verifyPassword(password, stored))) return null;
  if (needsPasswordHash(stored)) {
    const hashed = await hashPassword(password);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashed,
      user.id,
    ]);
  }
  return toPublic(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const [rows] = await getPool().query<UserRow[]>(
    `SELECT id, username, '' AS password_hash, name, email, phone, photo_name, level, active, created_at
     FROM users
     ORDER BY username`
  );
  return rows.map(toPublic);
}

export async function countOtherActiveSuperusers(exceptId: string): Promise<number> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM users WHERE level = 'superuser' AND active = 1 AND id <> ?",
    [exceptId]
  );
  return Number(rows[0]?.total || 0);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const [rows] = await getPool().query<UserRow[]>(
    `SELECT id, username, '' AS password_hash, name, email, phone, photo_name, level, active, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? toPublic(rows[0]) : null;
}

/** Lightweight lookup for session revalidation (active + level + name). */
export async function findAuthUserById(
  id: string
): Promise<{ id: string; level: string; name: string; active: "1" | "0" } | null> {
  const key = String(id || "").trim();
  if (!key) return null;
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, name, level, active FROM users WHERE id = ? LIMIT 1",
    [key]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name || ""),
    level: String(row.level || "user"),
    active: Number(row.active) === 1 ? "1" : "0",
  };
}

export async function insertUser(input: {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  level: string;
  active: "1" | "0";
}): Promise<PublicUser> {
  await getPool().query(
    `INSERT INTO users (
      id, username, password_hash, name, email, phone, level, active, created_at, photo_name
    ) VALUES (?, ?, ?, ?, '', '', ?, ?, ?, '')`,
    [input.id, input.username, input.passwordHash, input.name, input.level, input.active === "1" ? 1 : 0, new Date().toISOString()]
  );
  const saved = await findUserById(input.id);
  if (!saved) throw new Error("Pengguna tidak ditemukan");
  return saved;
}

export async function updateUser(
  id: string,
  input: {
    username: string;
    name: string;
    level: string;
    active: "1" | "0";
    passwordHash?: string;
  }
): Promise<PublicUser | null> {
  const pool = getPool();
  const [result] = input.passwordHash
    ? await pool.query<ResultSetHeader>(
        "UPDATE users SET username = ?, name = ?, level = ?, active = ?, password_hash = ? WHERE id = ?",
        [input.username, input.name, input.level, input.active === "1" ? 1 : 0, input.passwordHash, id]
      )
    : await pool.query<ResultSetHeader>(
        "UPDATE users SET username = ?, name = ?, level = ?, active = ? WHERE id = ?",
        [input.username, input.name, input.level, input.active === "1" ? 1 : 0, id]
      );
  if (!result.affectedRows) {
    const current = await findUserById(id);
    if (!current) return null;
  }
  return findUserById(id);
}

export async function deleteUser(id: string): Promise<boolean> {
  const [result] = await getPool().query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export function isDuplicateUserError(error: unknown): boolean {
  return typeof error === "object" && error != null && "errno" in error && (error as { errno?: number }).errno === 1062;
}
