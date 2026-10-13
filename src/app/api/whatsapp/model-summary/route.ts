import { NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import type { CardFieldState } from "@/lib/model-card-fields";
import { cardFields, sendModelSummary } from "@/lib/send-model-summary";
import type { SummaryUnit } from "@/lib/summary-view";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as { year?: string; mode?: string; fields?: Partial<CardFieldState> } | null;
  const yearText = body?.year || "";
  if (!/^\d{4}$/.test(yearText)) return badRequest("Tahun tidak valid");
  const mode: SummaryUnit = body?.mode === "hari" ? "hari" : "jam";
  const sent = await sendModelSummary({ year: Number(yearText), mode, fields: cardFields(body?.fields) });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.error.includes("Fonnte") || sent.error.includes("Tidak terhubung") ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
