import { NextResponse } from "next/server";
import { actorFromUser } from "@/db/backup";
import { countUnitsInGroup, deleteGroup, isDuplicateGroupError, listGroups, updateGroup } from "@/db/groups";
import { badRequest, requireWriter } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { isRowId } from "@/lib/row-input";
import { parseQuota } from "@/lib/units";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const body = (await request.json().catch(() => null)) as {
    group?: string;
    quota_hrs?: unknown;
  } | null;
  const group = String(body?.group || "").trim();
  const quota = parseQuota(String(body?.quota_hrs ?? ""));
  if (!group) return badRequest("Group wajib diisi");
  if (group.length > 128) return badRequest("Group terlalu panjang");
  if (quota == null) return badRequest("Quota Hrs harus angka");
  try {
    const saved = await updateGroup(id, { group, quota_hrs: quota }, actorFromUser(user));
    if (!saved) return NextResponse.json({ error: "Group tidak ditemukan" }, { status: 404 });
    publishLive("groups");
    return NextResponse.json({ group: saved });
  } catch (error) {
    if (isDuplicateGroupError(error)) return badRequest("Group sudah ada");
    throw error;
  }
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const groups = await listGroups();
  const current = groups.find((item) => item.id === id);
  if (!current) return NextResponse.json({ error: "Group tidak ditemukan" }, { status: 404 });
  const used = await countUnitsInGroup(current.group);
  if (used > 0) return badRequest("Group masih dipakai unit");
  const removed = await deleteGroup(id, actorFromUser(user));
  if (!removed) return NextResponse.json({ error: "Group tidak ditemukan" }, { status: 404 });
  publishLive("groups");
  return NextResponse.json({ ok: true });
}
