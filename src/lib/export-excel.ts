import * as XLSX from "xlsx";
import { parseHm, parseLocal } from "@/lib/calc";
import { sheetTitle } from "@/lib/format";
import { visibleHandoverRows } from "@/lib/board-rows";
import { periodQuota, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { groupByModel, sisaRemainder, SISA_LABELS, type SisaCell } from "@/lib/unit-sisa";
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

const SUMMARY_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "wtd", label: "WTD" },
  { key: "mtd", label: "MTD" },
  { key: "hytd1", label: "HYTD 1" },
  { key: "hytd2", label: "HYTD 2" },
  { key: "ytd", label: "YTD" },
];

const SUMMARY_WIDTH = 3 + 2 + SUMMARY_PERIODS.length * 3;

function summaryNumber(value: number | null): number | "" {
  if (value == null || !Number.isFinite(value)) return "";
  return Math.round(value * 100) / 100;
}

function summaryAsOfDate(asOf: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function unitNames(row: SummaryRow, members?: SummaryRow[]): string {
  const items = members
    ? members.map((item) => ({ name: item.unit.trim(), open: item.open }))
    : row.unit.split(",").map((part) => {
        const trimmed = part.trim();
        const marked = trimmed.endsWith("*");
        return {
          name: marked ? trimmed.slice(0, -1).trim() : trimmed,
          open: marked || (row.open && !row.unit.includes(",")),
        };
      });
  const names = items.filter((item) => item.name);
  if (names.length === 0) return "";
  return names.map((item) => (item.open ? `${item.name}*` : item.name)).join(", ");
}

function summaryDataRow(row: SummaryRow, now: Date, sisaSource: SummaryRow, members?: SummaryRow[]): (string | number)[] {
  const dailyLeft = sisaRemainder(sisaSource.quota_hrs, sisaSource.daily);
  const cells: (string | number)[] = [
    row.label,
    summaryNumber(row.quota_hrs),
    unitNames(row, members),
    summaryNumber(row.daily),
    summaryNumber(dailyLeft),
  ];
  for (const period of SUMMARY_PERIODS) {
    const quota = periodQuota(row.quota_hrs, period.key, now);
    const sisaQuota = periodQuota(sisaSource.quota_hrs, period.key, now);
    cells.push(summaryNumber(quota), summaryNumber(row[period.key]), summaryNumber(sisaRemainder(sisaQuota, sisaSource[period.key])));
  }
  return cells;
}

function summaryHeader(label: string): (string | number)[][] {
  const groups = [label, "Quota Hrs", "Unit", "Daily", ""];
  const details = ["", "", "", "Jam", "Sisa"];
  for (const period of SUMMARY_PERIODS) {
    groups.push(period.label, "", "");
    details.push("Quota Hrs", "Jam", "Sisa");
  }
  return [groups, details];
}

function summaryMerges(start: number): XLSX.Range[] {
  const merges: XLSX.Range[] = [
    { s: { r: start, c: 0 }, e: { r: start, c: SUMMARY_WIDTH - 1 } },
    { s: { r: start + 1, c: 0 }, e: { r: start + 2, c: 0 } },
    { s: { r: start + 1, c: 1 }, e: { r: start + 2, c: 1 } },
    { s: { r: start + 1, c: 2 }, e: { r: start + 2, c: 2 } },
    { s: { r: start + 1, c: 3 }, e: { r: start + 1, c: 4 } },
  ];
  SUMMARY_PERIODS.forEach((_, index) => {
    const column = 5 + index * 3;
    merges.push({ s: { r: start + 1, c: column }, e: { r: start + 1, c: column + 2 } });
  });
  return merges;
}

function summaryBlock(title: string, label: string, rows: (string | number)[][]): (string | number)[][] {
  return [[title], ...summaryHeader(label), ...rows];
}

export function buildSummarySheet(report: SummaryReport): XLSX.WorkSheet {
  const now = summaryAsOfDate(report.asOf);
  const unitRows = groupByModel(report.units).flatMap((group) => [
    summaryDataRow(group, now, group, group.members),
    ...group.members.map((member) => summaryDataRow(member, now, group)),
  ]);
  const groupRows = report.groups.map((row) => summaryDataRow(row, now, row));
  const unitBlock = summaryBlock("SUMMARY UNIT", "Model", unitRows);
  const groupBlock = summaryBlock("SUMMARY GROUP", "Group", groupRows);
  const sheet = XLSX.utils.aoa_to_sheet([...unitBlock, [], ...groupBlock]);
  const groupStart = unitBlock.length + 1;
  sheet["!merges"] = [...summaryMerges(0), ...summaryMerges(groupStart)];
  sheet["!cols"] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
    ...Array.from({ length: SUMMARY_WIDTH - 3 }, () => ({ wch: 12 })),
  ];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const hourColumns = new Set<number>([3, 4]);
  SUMMARY_PERIODS.forEach((_, index) => {
    hourColumns.add(6 + index * 3);
    hourColumns.add(7 + index * 3);
  });
  for (let row = 0; row <= range.e.r; row += 1) {
    for (const column of hourColumns) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
  }
  return sheet;
}

export function exportFileName(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `Export Data Armor ${year}${month}${day} ${hour}${minute}.xlsx`;
}

export function buildHandoverWorkbook(input: {
  date: string;
  shift: string;
  rows: HandoverRow[];
  now: Date;
  query: string;
  sisa?: Map<string, SisaCell[]>;
  summary?: SummaryReport;
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
  if (input.summary) XLSX.utils.book_append_sheet(book, buildSummarySheet(input.summary), "Summary");
  return book;
}

export function downloadHandoverExcel(input: {
  date: string;
  shift: string;
  rows: HandoverRow[];
  now: Date;
  query: string;
  sisa?: Map<string, SisaCell[]>;
  summary?: SummaryReport;
}) {
  const book = buildHandoverWorkbook(input);
  XLSX.writeFile(book, exportFileName());
}
