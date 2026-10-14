import { NextResponse } from "next/server";
import { findGroupByName } from "@/db/groups";
import { actorFromUser } from "@/db/backup";
import { findModelByName } from "@/db/models";
import { deleteUnit, isDuplicateUnitError, updateUnit } from "@/db/units";
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
    model?: string;
    quota_hrs?: unknown;
    unit?: string;
    group?: string;
  } | null;
  let model = String(body?.model || "").trim();
  const unit = String(body?.unit || "").trim();
  let group = String(body?.group || "").trim();
  const quota = parseQuota(String(body?.quota_hrs ?? ""));
  if (!model) return badRequest("Model wajib diisi");
  if (model.length > 64) return badRequest("Model terlalu panjang");
  if (quota == null) return badRequest("Quota Hrs harus angka");
  if (!unit) return badRequest("Unit wajib diisi");
  if (unit.length > 128) return badRequest("Unit terlalu panjang");
  if (group.length > 128) return badRequest("Group terlalu panjang");
  const knownModel = await findModelByName(model);
  if (!knownModel) return badRequest("Model harus dipilih dari master");
  model = knownModel.model;
  if (group) {
    const known = await findGroupByName(group);
    if (!known) return badRequest("Group harus dipilih dari master");
    group = known.group;
  }
  try {
    const saved = await updateUnit(id, { model, quota_hrs: quota, unit, group }, actorFromUser(user));
    if (!saved) return NextResponse.json({ error: "Unit tidak ditemukan" }, { status: 404 });
    publishLive("units");
    return NextResponse.json({ unit: saved });
  } catch (error) {
    if (isDuplicateUnitError(error)) return badRequest("Unit sudah ada");
    throw error;
  }
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const removed = await deleteUnit(id, actorFromUser(user));
  if (!removed) return NextResponse.json({ error: "Unit tidak ditemukan" }, { status: 404 });
  publishLive("units");
  return NextResponse.json({ ok: true });
}
