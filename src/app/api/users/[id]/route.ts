import { NextResponse } from "next/server";
import {
  countOtherActiveSuperusers,
  deleteUser,
  findUserById,
  isDuplicateUserError,
  updateUser,
} from "@/db/users";
import { badRequest, requireSuperuser } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { hashPassword } from "@/lib/password";
import { validateUserInput } from "@/lib/user-input";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function isUserId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export async function PATCH(request: Request, context: Context) {
  const actor = await requireSuperuser();
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  if (!isUserId(id)) return badRequest("Id tidak valid");
  const current = await findUserById(id);
  if (!current) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    name?: unknown;
    level?: unknown;
    active?: unknown;
    password?: unknown;
  } | null;
  const input = {
    username: String(body?.username || ""),
    name: String(body?.name || ""),
    level: String(body?.level || ""),
    active: String(body?.active || ""),
    password: String(body?.password || ""),
  };
  const message = validateUserInput(input, false);
  if (message) return badRequest(message);
  const username = input.username.trim();
  const name = input.name.trim();
  const active = input.active === "1" ? "1" : "0";
  if (id === actor.id && (input.level !== "superuser" || active !== "1")) {
    return badRequest("Akun yang sedang dipakai harus tetap superuser aktif");
  }
  const leavesSuperuser = current.level === "superuser" && current.active === "1" && !(input.level === "superuser" && active === "1");
  if (leavesSuperuser && (await countOtherActiveSuperusers(id)) === 0) {
    return badRequest("Harus tersisa satu superuser aktif");
  }
  try {
    const saved = await updateUser(id, {
      username,
      name,
      level: input.level,
      active,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    });
    if (!saved) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    publishLive("users");
    return NextResponse.json({ user: saved });
  } catch (error) {
    if (isDuplicateUserError(error)) return badRequest("Username sudah ada");
    throw error;
  }
}

export async function DELETE(_request: Request, context: Context) {
  const actor = await requireSuperuser();
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  if (!isUserId(id)) return badRequest("Id tidak valid");
  if (id === actor.id) return badRequest("Tidak dapat menghapus akun yang sedang dipakai");
  const current = await findUserById(id);
  if (!current) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  if (current.level === "superuser" && current.active === "1" && (await countOtherActiveSuperusers(id)) === 0) {
    return badRequest("Harus tersisa satu superuser aktif");
  }
  const removed = await deleteUser(id);
  if (!removed) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  publishLive("users");
  return NextResponse.json({ ok: true });
}
