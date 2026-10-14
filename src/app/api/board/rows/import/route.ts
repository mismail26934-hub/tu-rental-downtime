import { NextResponse } from "next/server";
import { actorFromUser } from "@/db/backup";
import { saveRow } from "@/db/handover";
import { listUnits } from "@/db/units";
import { badRequest, requireWriter } from "@/lib/http";
import { defaultShift, todayISO } from "@/lib/format";
import { publishLive } from "@/lib/live";
import { normalizeRowInput, validateRowInput } from "@/lib/row-input";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ROWS = 300;

function matchUnit(units: Awaited<ReturnType<typeof listUnits>>, code: string) {
  const key = code.trim().replace(/\*$/, "").toLowerCase();
  if (!key) return null;
  return units.find((item) => item.unit.trim().toLowerCase() === key) ?? null;
}

export async function POST(request: Request) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as { year?: string; rows?: unknown[] } | null;
  const year = String(body?.year || "");
  if (!/^\d{4}$/.test(year)) return badRequest("Tahun tidak valid");
  const source = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!source.length) return badRequest("Tidak ada baris untuk ditambahkan");

  const today = todayISO();
  const sheet = today.startsWith(`${year}-`)
    ? { date: today, shift: defaultShift() }
    : { date: `${year}-01-01`, shift: "DS" as Shift };
  const units = await listUnits();
  const actor = actorFromUser(user);
  const sheetId = crypto.randomUUID();
  const errors: { line: number; unit: string; message: string }[] = [];
  let saved = 0;

  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index] as { line?: number; input?: unknown } | null;
    const line = Number(raw?.line) || index + 1;
    const input = normalizeRowInput(raw?.input);
    if (!input) {
      errors.push({ line, unit: "", message: "Data baris tidak valid" });
      continue;
    }
    const invalid = validateRowInput(input);
    if (invalid) {
      errors.push({ line, unit: input.unit, message: invalid });
      continue;
    }
    const known = matchUnit(units, input.unit);
    if (!known) {
      errors.push({ line, unit: input.unit, message: "Unit harus dipilih dari master" });
      continue;
    }
    input.unit = known.unit;
    if (input.unit_backup.trim()) {
      const backup = matchUnit(units, input.unit_backup);
      if (!backup) {
        errors.push({ line, unit: input.unit, message: "Unit Back up harus dipilih dari master" });
        continue;
      }
      input.unit_backup = backup.unit;
    }
    try {
      await saveRow({
        sheet: { id: sheetId, sheet_date: sheet.date, shift: sheet.shift },
        row: { ...input, id: crypto.randomUUID() },
        actor,
      });
      saved += 1;
    } catch (error) {
      errors.push({
        line,
        unit: input.unit,
        message: error instanceof Error ? error.message : "Gagal menyimpan",
      });
    }
  }

  if (saved > 0) publishLive("board");
  return NextResponse.json({ saved, errors });
}
