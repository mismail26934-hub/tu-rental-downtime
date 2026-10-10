import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import { badRequest, requireUser, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = String(body?.name || "").trim().slice(0, 255);
  if (!name) return badRequest("Nama wajib diisi");
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE users SET name = ? WHERE id = ?",
    [name, user.id]
  );
  if (!result.affectedRows) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT name FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );
  return NextResponse.json({ name: String(rows[0]?.name || name) });
}
