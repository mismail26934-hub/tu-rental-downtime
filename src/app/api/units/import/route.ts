import { NextResponse } from "next/server";
import { findGroupByName, listGroups } from "@/db/groups";
import { ensureModelsFromUnits, findModelByName, listModels } from "@/db/models";
import { insertUnit, isDuplicateUnitError, listUnits } from "@/db/units";
import { badRequest, requireWriter } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { isRowId } from "@/lib/row-input";
import { parseQuota } from "@/lib/units";

export const dynamic = "force-dynamic";

const MAX_ROWS = 300;

export async function POST(request: Request) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as {
    rows?: {
      line?: number;
      model?: string;
      quota_hrs?: unknown;
      unit?: string;
      group?: string;
    }[];
  } | null;
  const source = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!source.length) return badRequest("Tidak ada baris untuk ditambahkan");

  await ensureModelsFromUnits();
  const existingUnits = new Set((await listUnits()).map((item) => item.unit.trim().toLowerCase()));
  const knownModels = new Map(
    (await listModels()).map((item) => [item.model.trim().toLowerCase(), item.model] as const)
  );
  const knownGroups = new Map(
    (await listGroups()).map((item) => [item.group.trim().toLowerCase(), item.group] as const)
  );
  const seen = new Set<string>();
  const errors: { line: number; unit: string; message: string }[] = [];
  let saved = 0;

  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index];
    const line = Number(raw?.line) || index + 1;
    let model = String(raw?.model || "").trim();
    const unit = String(raw?.unit || "").trim();
    let group = String(raw?.group || "").trim();
    const quota = parseQuota(String(raw?.quota_hrs ?? ""));
    if (!model) {
      errors.push({ line, unit, message: "Model wajib diisi" });
      continue;
    }
    if (model.length > 64) {
      errors.push({ line, unit, message: "Model terlalu panjang" });
      continue;
    }
    if (quota == null) {
      errors.push({ line, unit, message: "Quota Hrs harus angka" });
      continue;
    }
    if (!unit) {
      errors.push({ line, unit, message: "Unit wajib diisi" });
      continue;
    }
    if (unit.length > 128) {
      errors.push({ line, unit, message: "Unit terlalu panjang" });
      continue;
    }
    if (group.length > 128) {
      errors.push({ line, unit, message: "Group terlalu panjang" });
      continue;
    }
    const knownModel = knownModels.get(model.toLowerCase()) || (await findModelByName(model))?.model;
    if (!knownModel) {
      errors.push({ line, unit, message: "Model harus dipilih dari master" });
      continue;
    }
    model = knownModel;
    knownModels.set(model.toLowerCase(), model);
    if (group) {
      const known = knownGroups.get(group.toLowerCase()) || (await findGroupByName(group))?.group;
      if (!known) {
        errors.push({ line, unit, message: "Group harus dipilih dari master" });
        continue;
      }
      group = known;
      knownGroups.set(group.toLowerCase(), group);
    }
    const key = unit.toLowerCase();
    if (existingUnits.has(key) || seen.has(key)) {
      errors.push({ line, unit, message: "Unit sudah ada" });
      continue;
    }
    const id = crypto.randomUUID();
    if (!isRowId(id)) {
      errors.push({ line, unit, message: "Id tidak valid" });
      continue;
    }
    try {
      await insertUnit(id, { model, quota_hrs: quota, unit, group });
      seen.add(key);
      existingUnits.add(key);
      saved += 1;
    } catch (error) {
      if (isDuplicateUnitError(error)) {
        errors.push({ line, unit, message: "Unit sudah ada" });
        continue;
      }
      errors.push({
        line,
        unit,
        message: error instanceof Error ? error.message : "Gagal menyimpan",
      });
    }
  }

  if (saved > 0) publishLive("units");
  return NextResponse.json({ saved, errors });
}
