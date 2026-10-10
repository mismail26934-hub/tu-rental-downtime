import { NextResponse } from "next/server";
import { listGroups } from "@/db/groups";
import { listSheetYears } from "@/db/handover";
import { listSummaryEvents } from "@/db/summary";
import { listUnits } from "@/db/units";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import { buildSummary, summaryAsOf } from "@/lib/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const yearText = new URL(request.url).searchParams.get("year") || "";
  if (yearText && !/^\d{4}$/.test(yearText)) return badRequest("Tahun tidak valid");
  const year = yearText ? Number(yearText) : new Date().getFullYear();
  const [events, units, groups, years] = await Promise.all([
    listSummaryEvents(),
    listUnits(),
    listGroups(),
    listSheetYears(),
  ]);
  const report = buildSummary({
    now: summaryAsOf(year),
    years,
    events,
    units: units.map((unit) => ({
      id: unit.id,
      model: unit.model,
      quota_hrs: unit.quota_hrs,
      unit: unit.unit,
      group: unit.group,
    })),
    groups: groups.map((group) => ({
      id: group.id,
      group: group.group,
      quota_hrs: group.quota_hrs,
    })),
  });
  return NextResponse.json(report);
}
