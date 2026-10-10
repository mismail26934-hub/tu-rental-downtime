import type { RowDataPacket } from "mysql2";
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
