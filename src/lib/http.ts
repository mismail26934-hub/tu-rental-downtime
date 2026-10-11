import { auth } from "@/auth";
import { canManage, isSuperuser } from "@/lib/access";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireWriter() {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!canManage(user.level)) return forbidden();
  return user;
}

export async function requireSuperuser() {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!isSuperuser(user.level)) return forbidden();
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Tidak memiliki akses" }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
