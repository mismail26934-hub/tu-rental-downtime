import { NextResponse } from "next/server";
import { readWaSchedule, writeWaSchedule, type WaSchedule } from "@/db/wa-schedule";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import type { CardFieldState } from "@/lib/model-card-fields";
import { cardFields } from "@/lib/send-model-summary";
import type { SummaryUnit } from "@/lib/summary-view";
import { clampInterval, formatLocalDateTime, nextFutureSlot, normalizeClock } from "@/lib/wa-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  return NextResponse.json(await readWaSchedule());
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean;
    intervalMinutes?: number;
    activeFrom?: string;
    activeUntil?: string;
    year?: string;
    mode?: string;
    fields?: Partial<CardFieldState>;
  } | null;
  const activeFrom = normalizeClock(body?.activeFrom || "");
  const activeUntil = normalizeClock(body?.activeUntil || "");
  if (!activeFrom || !activeUntil) return badRequest("Jam aktif tidak valid");
  const year = body?.year || "";
  if (body?.enabled && !/^\d{4}$/.test(year)) return badRequest("Tahun tidak valid");
  const mode: SummaryUnit = body?.mode === "hari" ? "hari" : "jam";
  const current = await readWaSchedule();
  const enabled = Boolean(body?.enabled);
  const intervalMinutes = clampInterval(Number(body?.intervalMinutes));
  const timingChanged = !current.enabled || current.intervalMinutes !== intervalMinutes || current.activeFrom !== activeFrom || current.activeUntil !== activeUntil;
  const now = new Date();
  const next: WaSchedule = {
    enabled,
    intervalMinutes,
    activeFrom,
    activeUntil,
    mode,
    year: /^\d{4}$/.test(year) ? year : current.year,
    fields: cardFields(body?.fields),
    nextRunAt: enabled && timingChanged
      ? formatLocalDateTime(nextFutureSlot(now, now, intervalMinutes, activeFrom, activeUntil))
      : current.nextRunAt,
    lastRunAt: current.lastRunAt,
    lastError: "",
  };
  await writeWaSchedule(next);
  return NextResponse.json(next);
}
