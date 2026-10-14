import { NextResponse } from "next/server";
import { ensureModelsFromUnits, insertModel, isDuplicateModelError, listModels } from "@/db/models";
import { badRequest, requireUser, requireWriter, unauthorized } from "@/lib/http";
import { publishLive } from "@/lib/live";
import { validateModelInput } from "@/lib/models";
import { isRowId } from "@/lib/row-input";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  await ensureModelsFromUnits();
  const models = await listModels();
  return NextResponse.json({ models });
}

export async function POST(request: Request) {
  const user = await requireWriter();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    model?: string;
  } | null;
  const id = String(body?.id || "");
  const model = String(body?.model || "").trim();
  if (!isRowId(id)) return badRequest("Id tidak valid");
  const invalid = validateModelInput({ model });
  if (invalid) return badRequest(invalid);
  try {
    const saved = await insertModel(id, { model });
    publishLive("models");
    return NextResponse.json({ model: saved });
  } catch (error) {
    if (isDuplicateModelError(error)) return badRequest("Model sudah ada");
    throw error;
  }
}
