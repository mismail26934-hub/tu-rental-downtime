import { NextResponse } from "next/server";
import { findUnitByCode } from "@/db/units";
import { actorFromUser } from "@/db/backup";
import { saveRow } from "@/db/handover";
import { computeMetrics } from "@/lib/calc";
import { badRequest, requireWriter } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { isRowId, isSheetDate, normalizeRowInput, validateRowInput } from "@/lib/row-input";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as {
    sheet?: { id?: string; sheet_date?: string; shift?: string };
    row?: { id?: string };
  } | null;
  const sheet = body?.sheet;
  const date = String(sheet?.sheet_date || "");
  const shift = String(sheet?.shift || "");
  const sheetId = String(sheet?.id || "");
  const rowId = String(body?.row?.id || "");
  if (!isSheetDate(date) || (shift !== "NS" && shift !== "DS")) {
    return badRequest("Tanggal atau shift tidak valid");
  }
  if (!isRowId(sheetId) || !isRowId(rowId)) return badRequest("Id tidak valid");
  const input = normalizeRowInput(body?.row);
  if (!input) return badRequest("Data baris tidak valid");
  const error = validateRowInput(input);
  if (error) return badRequest(error);
  const known = await findUnitByCode(input.unit);
  if (!known) return badRequest("Unit harus dipilih dari master");
  input.unit = known.unit;

  const saved = await saveRow({
    sheet: { id: sheetId, sheet_date: date, shift: shift as Shift },
    row: { ...input, id: rowId },
    actor: actorFromUser(user),
  });
  publishLive("board");
  return NextResponse.json({
    sheet: saved.sheet,
    row: { ...saved.row, metrics: computeMetrics(saved.row) },
  });
}
