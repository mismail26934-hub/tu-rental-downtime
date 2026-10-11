import { NextResponse } from "next/server";
import { insertUser, isDuplicateUserError, listUsers } from "@/db/users";
import { badRequest, requireSuperuser } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { isRowId } from "@/lib/row-input";
import { validateUserInput } from "@/lib/user-input";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSuperuser();
  if (user instanceof NextResponse) return user;
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const actor = await requireSuperuser();
  if (actor instanceof NextResponse) return actor;
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    username?: unknown;
    name?: unknown;
    level?: unknown;
    active?: unknown;
    password?: unknown;
  } | null;
  const id = String(body?.id || "");
  const input = {
    username: String(body?.username || ""),
    name: String(body?.name || ""),
    level: String(body?.level || ""),
    active: String(body?.active || ""),
    password: String(body?.password || ""),
  };
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const message = validateUserInput(input, true);
  if (message) return badRequest(message);
  try {
    const saved = await insertUser({
      id,
      username: input.username.trim(),
      passwordHash: await hashPassword(input.password),
      name: input.name.trim(),
      level: input.level,
      active: input.active === "1" ? "1" : "0",
    });
    return NextResponse.json({ user: saved });
  } catch (error) {
    if (isDuplicateUserError(error)) return badRequest("Username sudah ada");
    throw error;
  }
}
