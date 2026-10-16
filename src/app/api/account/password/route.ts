import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/db/pool";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");
  if (!currentPassword || !newPassword) return badRequest("Password wajib diisi");
  const policyError = passwordPolicyError(newPassword);
  if (policyError) return badRequest(policyError);

  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );
  const stored = String(rows[0]?.password_hash || "");
  if (!(await verifyPassword(currentPassword, stored))) {
    return badRequest("Password sekarang salah");
  }
  const passwordHash = await hashPassword(newPassword);
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
    passwordHash,
    user.id,
  ]);
  return NextResponse.json({ ok: true });
}
