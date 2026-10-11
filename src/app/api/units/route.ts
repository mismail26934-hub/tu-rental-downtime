import { NextResponse } from "next/server";
import { findGroupByName } from "@/db/groups";
import { insertUnit, isDuplicateUnitError, listUnits } from "@/db/units";
import { badRequest, requireUser, requireWriter, unauthorized } from "@/lib/http";
import { isRowId } from "@/lib/row-input";
import { parseQuota } from "@/lib/units";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const units = await listUnits();
  return NextResponse.json({ units });
}

export async function POST(request: Request) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    model?: string;
    quota_hrs?: unknown;
    unit?: string;
    group?: string;
  } | null;
  const id = String(body?.id || "");
  const model = String(body?.model || "").trim();
  const unit = String(body?.unit || "").trim();
  let group = String(body?.group || "").trim();
  const quota = parseQuota(String(body?.quota_hrs ?? ""));
  if (!isRowId(id)) return badRequest("Id tidak valid");
  if (!model) return badRequest("Model wajib diisi");
  if (model.length > 64) return badRequest("Model terlalu panjang");
  if (quota == null) return badRequest("Quota Hrs harus angka");
  if (!unit) return badRequest("Unit wajib diisi");
  if (unit.length > 128) return badRequest("Unit terlalu panjang");
  if (group.length > 128) return badRequest("Group terlalu panjang");
  if (group) {
    const known = await findGroupByName(group);
    if (!known) return badRequest("Group harus dipilih dari master");
    group = known.group;
  }
  try {
    const saved = await insertUnit(id, { model, quota_hrs: quota, unit, group });
    return NextResponse.json({ unit: saved });
  } catch (error) {
    if (isDuplicateUnitError(error)) return badRequest("Unit sudah ada");
    throw error;
  }
}
