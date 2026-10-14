import { NextResponse } from "next/server";
import { insertGroup, isDuplicateGroupError, listGroups } from "@/db/groups";
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
    rows?: { line?: number; group?: string; quota_hrs?: unknown }[];
  } | null;
  const source = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!source.length) return badRequest("Tidak ada baris untuk ditambahkan");

  const existing = new Set((await listGroups()).map((item) => item.group.trim().toLowerCase()));
  const seen = new Set<string>();
  const errors: { line: number; group: string; message: string }[] = [];
  let saved = 0;

  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index];
    const line = Number(raw?.line) || index + 1;
    const group = String(raw?.group || "").trim();
    const quota = parseQuota(String(raw?.quota_hrs ?? ""));
    if (!group) {
      errors.push({ line, group, message: "Group wajib diisi" });
      continue;
    }
    if (group.length > 128) {
      errors.push({ line, group, message: "Group terlalu panjang" });
      continue;
    }
    if (quota == null) {
      errors.push({ line, group, message: "Quota Hrs harus angka" });
      continue;
    }
    const key = group.toLowerCase();
    if (existing.has(key) || seen.has(key)) {
      errors.push({ line, group, message: "Group sudah ada" });
      continue;
    }
    const id = crypto.randomUUID();
    if (!isRowId(id)) {
      errors.push({ line, group, message: "Id tidak valid" });
      continue;
    }
    try {
      await insertGroup(id, { group, quota_hrs: quota });
      seen.add(key);
      existing.add(key);
      saved += 1;
    } catch (error) {
      if (isDuplicateGroupError(error)) {
        errors.push({ line, group, message: "Group sudah ada" });
        continue;
      }
      errors.push({
        line,
        group,
        message: error instanceof Error ? error.message : "Gagal menyimpan",
      });
    }
  }

  if (saved > 0) publishLive("groups");
  return NextResponse.json({ saved, errors });
}
