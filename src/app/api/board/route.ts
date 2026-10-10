import { NextResponse } from "next/server";
import { getBoard, getBoardYear } from "@/db/handover";
import { computeMetrics } from "@/lib/calc";
import { badRequest, requireUser, unauthorized } from "@/lib/http";
import { isSheetDate } from "@/lib/row-input";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const year = url.searchParams.get("year") || "";
  if (year) {
    if (!/^\d{4}$/.test(year)) return badRequest("Tahun tidak valid");
    const board = await getBoardYear(year);
    return NextResponse.json({
      sheet: null,
      years: board.years,
      rows: board.rows.map((row) => ({ ...row, metrics: computeMetrics(row) })),
    });
  }
  const date = url.searchParams.get("date") || "";
  const shift = url.searchParams.get("shift") || "";
  if (!isSheetDate(date) || (shift !== "NS" && shift !== "DS")) {
    return badRequest("Tanggal atau shift tidak valid");
  }
  const board = await getBoard(date, shift as Shift);
  return NextResponse.json({
    sheet: board.sheet,
    rows: board.rows.map((row) => ({ ...row, metrics: computeMetrics(row) })),
  });
}
