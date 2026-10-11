import { NextResponse } from "next/server";
import { actorFromUser } from "@/db/backup";
import { deleteRow, updateRow } from "@/db/handover";
import { findUnitByCode } from "@/db/units";
import { computeMetrics } from "@/lib/calc";
import { badRequest, requireWriter } from "@/lib/http";
import { isRowId, normalizeRowInput, validateRowInput } from "@/lib/row-input";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const input = normalizeRowInput(await request.json().catch(() => null));
  if (!input) return badRequest("Data baris tidak valid");
  const error = validateRowInput(input);
  if (error) return badRequest(error);
  const known = await findUnitByCode(input.unit);
  if (!known) return badRequest("Unit harus dipilih dari master");
  input.unit = known.unit;
  const row = await updateRow(id, input, actorFromUser(user));
  if (!row) return NextResponse.json({ error: "Baris tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ row: { ...row, metrics: computeMetrics(row) } });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const removed = await deleteRow(id, actorFromUser(user));
  if (!removed) return NextResponse.json({ error: "Baris tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
