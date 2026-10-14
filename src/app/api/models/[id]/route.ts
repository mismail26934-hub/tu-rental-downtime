import { NextResponse } from "next/server";
import { actorFromUser } from "@/db/backup";
import {
  countUnitsWithModel,
  deleteModel,
  isDuplicateModelError,
  listModels,
  updateModel,
} from "@/db/models";
import { badRequest, requireWriter } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { validateModelInput } from "@/lib/models";
import { isRowId } from "@/lib/row-input";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const body = (await request.json().catch(() => null)) as { model?: string } | null;
  const model = String(body?.model || "").trim();
  const invalid = validateModelInput({ model });
  if (invalid) return badRequest(invalid);
  try {
    const saved = await updateModel(id, { model }, actorFromUser(user));
    if (!saved) return NextResponse.json({ error: "Model tidak ditemukan" }, { status: 404 });
    publishLive("models");
    return NextResponse.json({ model: saved });
  } catch (error) {
    if (isDuplicateModelError(error)) return badRequest("Model sudah ada");
    throw error;
  }
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const models = await listModels();
  const current = models.find((item) => item.id === id);
  if (!current) return NextResponse.json({ error: "Model tidak ditemukan" }, { status: 404 });
  const used = await countUnitsWithModel(current.model);
  if (used > 0) return badRequest("Model masih dipakai unit");
  const removed = await deleteModel(id, actorFromUser(user));
  if (!removed) return NextResponse.json({ error: "Model tidak ditemukan" }, { status: 404 });
  publishLive("models");
  return NextResponse.json({ ok: true });
}
