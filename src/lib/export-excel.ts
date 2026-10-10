import * as XLSX from "xlsx";
import { parseHm, parseLocal } from "@/lib/calc";
import { sheetTitle } from "@/lib/format";
import { visibleHandoverRows } from "@/lib/board-rows";
import { SISA_LABELS, type SisaCell } from "@/lib/unit-sisa";
import type { HandoverRow } from "@/lib/types";

const HEADERS = [
  "#",
  "Crew",
  "Unit",
  "Location",
  "Technician",
  "Status",
  "Waiting Labour",
  "Repair Time",
  "RD30",
  "HM awal",
  "HM akhir",
  "ERDM",
  "Breakdown problem",
  "Done / Action",
  "Continue / Handover",
  "SO",
  "Waiting Labour",
  "Repair time",
  "DT Total",
  ...SISA_LABELS,
] as const;

function round2(value: number | null): number | "" {
  if (value == null || !Number.isFinite(value)) return "";
  return Math.round(value * 100) / 100;
}

function stamp(value: string): Date | "" {
  const time = parseLocal(value);
  return time == null ? "" : new Date(time);
}

function dtCell(label: string, total: number | null): number | string {
  if (label === "N/Y Ready") return "N/Y Ready";
  return round2(total);
}

function dataRow(
  item: ReturnType<typeof visibleHandoverRows>[number],
  sisa?: Map<string, SisaCell[]>
): (string | number | Date)[] {
  const { row, number, metrics } = item;
  const cells = sisa?.get(row.unit.trim().toLowerCase());
  return [
    number,
    row.crew,
    row.unit,
    row.location,
    row.technician,
    row.status,
    stamp(row.waiting_labour_at),
    stamp(row.repair_started_at),
    stamp(row.rd30_at),
    parseHm(row.hm_awal) ?? "",
    parseHm(row.hm_akhir) ?? "",
    round2(metrics.erdm),
    row.breakdown_problem,
    row.done_action,
    row.continue_handover,
    row.so,
    round2(metrics.waitingLabourHours),
    round2(metrics.repairHours),
    dtCell(metrics.dtLabel, metrics.dtTotal),
    ...SISA_LABELS.map((_, index) => {
      const left = cells?.[index]?.left;
      return left == null ? "" : left;
    }),
  ];
}

export function buildHandoverWorkbook(input: {
  date: string;
  shift: string;
  rows: HandoverRow[];
  now: Date;
  query: string;
  sisa?: Map<string, SisaCell[]>;
}) {
  const title = input.shift ? sheetTitle(input.date, input.shift) : input.date;
  const listed = visibleHandoverRows(input.rows, input.now, input.query);
  const groups = [
    "#",
    "Crew",
    "Unit",
    "Location",
    "Technician",
    "Status",
    "Time",
    "",
    "",
    "Hours Meter (HM)",
    "",
    "",
    "Remark",
    "",
    "",
    "SO",
    "Output Time",
    "",
    "",
    "Sisa Quota Hrs",
    "",
    "",
    "",
    "",
    "",
  ];
  const sheet = XLSX.utils.aoa_to_sheet([
    [title],
    groups,
    [...HEADERS],
    ...listed.map((item) => dataRow(item, input.sisa)),
  ]);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } },
    { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } },
    { s: { r: 1, c: 6 }, e: { r: 1, c: 8 } },
    { s: { r: 1, c: 9 }, e: { r: 1, c: 11 } },
    { s: { r: 1, c: 12 }, e: { r: 1, c: 14 } },
    { s: { r: 1, c: 15 }, e: { r: 2, c: 15 } },
    { s: { r: 1, c: 16 }, e: { r: 1, c: 18 } },
    { s: { r: 1, c: 19 }, e: { r: 1, c: 24 } },
  ];
  sheet["!cols"] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 36 },
    { wch: 36 },
    { wch: 36 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let row = 3; row <= range.e.r; row += 1) {
    for (const column of [6, 7, 8]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && (cell.t === "d" || cell.t === "n") && typeof cell.v !== "string") {
        cell.z = "dd/mm/yyyy hh:mm";
      }
    }
    for (const column of [9, 10, 11, 16, 17]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
    const dt = sheet[XLSX.utils.encode_cell({ r: row, c: 18 })];
    if (dt && dt.t === "n") dt.z = "0.00";
    for (const column of [19, 20, 21, 22, 23, 24]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Handover");
  return book;
}

export function downloadHandoverExcel(input: {
  date: string;
  shift: string;
  rows: HandoverRow[];
  now: Date;
  query: string;
  sisa?: Map<string, SisaCell[]>;
}) {
  const book = buildHandoverWorkbook(input);
  const filename = input.shift ? `handover-${input.date}-${input.shift}.xlsx` : `handover-${input.date}.xlsx`;
  XLSX.writeFile(book, filename);
}
