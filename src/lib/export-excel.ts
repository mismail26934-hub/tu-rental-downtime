import * as XLSX from "xlsx";
import JSZip from "jszip";
import { parseHm, parseLocal } from "@/lib/calc";
import { sheetTitle } from "@/lib/format";
import { visibleHandoverRows } from "@/lib/board-rows";
import { PERIODS, periodQuota, summaryUnitMarks, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { groupByModel, sisaRemainder, SISA_LABELS, type SisaCell } from "@/lib/unit-sisa";
import type { UnitMaster } from "@/lib/units";
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
  "Unit Back up",
  "Back up time",
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
    row.unit_backup,
    stamp(row.backup_time),
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

function fillGrid(sheet: XLSX.WorkSheet, startRow: number, endRow: number, startCol: number, endCol: number) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startCol; column <= endCol; column += 1) {
      const ref = XLSX.utils.encode_cell({ r: row, c: column });
      if (!sheet[ref]) sheet[ref] = { t: "s", v: "" };
    }
  }
}

const THIN_BORDERS =
  '<borders count="1"><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>';

async function workbookBlob(book: XLSX.WorkBook): Promise<Blob> {
  const data = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(data);
  const stylesFile = zip.file("xl/styles.xml");
  const styles = await stylesFile?.async("string");
  if (styles) {
    const bordered = styles
      .replace(/<borders count="1">[\s\S]*?<\/borders>/, THIN_BORDERS)
      .replace(/<xf\b([^>]*?)\/>/g, (tag, attrs: string) =>
        /\bapplyBorder=/.test(attrs) ? tag : `<xf${attrs} applyBorder="1"/>`,
      );
    zip.file("xl/styles.xml", bordered);
  }
  const sheets = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/);
  await Promise.all(
    sheets.map(async (file) => {
      const xml = await file.async("string");
      zip.file(
        file.name,
        xml.replace(/<c\b([^>]*?)>/g, (tag, attrs: string) => (/\bs=/.test(attrs) ? tag : `<c${attrs} s="0">`)),
      );
    }),
  );
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

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
  return summaryUnitMarks(row, members)
    .map((item) => (item.open ? `${item.name}*` : item.name))
    .join(", ");
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
  const detailRows: number[] = [];
  let cursor = 3;
  const unitRows = groupByModel(report.units).flatMap((group) => {
    const parent = summaryDataRow(group, now, group, group.members);
    cursor += 1;
    if (group.members.length < 2) return [parent];
    return [
      parent,
      ...group.members.map((member) => {
        detailRows.push(cursor);
        cursor += 1;
        return summaryDataRow(member, now, group);
      }),
    ];
  });
  const groupRows = report.groups.map((row) => summaryDataRow(row, now, row));
  const unitBlock = summaryBlock("SUMMARY UNIT", "Model", unitRows);
  const groupBlock = summaryBlock("SUMMARY GROUP", "Group", groupRows);
  const sheet = XLSX.utils.aoa_to_sheet([...unitBlock, [], ...groupBlock]);
  const rows: XLSX.RowInfo[] = [];
  for (const row of detailRows) rows[row] = { level: 1 };
  sheet["!rows"] = rows;
  sheet["!outline"] = { above: true };
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
  fillGrid(sheet, 0, unitBlock.length - 1, 0, SUMMARY_WIDTH - 1);
  fillGrid(sheet, groupStart, groupStart + groupBlock.length - 1, 0, SUMMARY_WIDTH - 1);
  return sheet;
}

export function exportFileName(now = new Date(), label = "Export Data Armor"): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${label} ${year}${month}${day} ${hour}${minute}.xlsx`;
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
    "BACK UP",
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
    { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } },
    { s: { r: 1, c: 14 }, e: { r: 1, c: 16 } },
    { s: { r: 1, c: 17 }, e: { r: 2, c: 17 } },
    { s: { r: 1, c: 18 }, e: { r: 1, c: 20 } },
    { s: { r: 1, c: 21 }, e: { r: 1, c: 26 } },
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
    { wch: 14 },
    { wch: 18 },
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
    for (const column of [6, 7, 8, 13]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && (cell.t === "d" || cell.t === "n") && typeof cell.v !== "string") {
        cell.z = "dd/mm/yyyy hh:mm";
      }
    }
    for (const column of [9, 10, 11, 18, 19]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
    const dt = sheet[XLSX.utils.encode_cell({ r: row, c: 20 })];
    if (dt && dt.t === "n") dt.z = "0.00";
    for (const column of [21, 22, 23, 24, 25, 26]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
  }
  const handoverRange = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  fillGrid(sheet, handoverRange.s.r, handoverRange.e.r, handoverRange.s.c, handoverRange.e.c);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Handover");
  if (input.summary) XLSX.utils.book_append_sheet(book, buildSummarySheet(input.summary), "Summary");
  return book;
}

const MASTER_PERIOD_LABEL: Record<PeriodKey, string> = {
  daily: "Daily",
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

function blankPeriodCells(): (number | "")[] {
  return PERIODS.flatMap(() => ["", "", ""]);
}

function periodValueCells(quota: number | null, hours: Record<PeriodKey, number> | null, now: Date): (number | "")[] {
  if (quota == null) return blankPeriodCells();
  return PERIODS.flatMap((period) => {
    const quotaValue = periodQuota(quota, period, now);
    if (hours == null || quotaValue == null) return [summaryNumber(quotaValue), "", ""] as (number | "")[];
    return [summaryNumber(quotaValue), summaryNumber(hours[period]), summaryNumber(sisaRemainder(quotaValue, hours[period]))];
  });
}

function summaryHours(row: SummaryRow | undefined): Record<PeriodKey, number> | null {
  if (!row) return { daily: 0, wtd: 0, mtd: 0, hytd1: 0, hytd2: 0, ytd: 0 };
  return { daily: row.daily, wtd: row.wtd, mtd: row.mtd, hytd1: row.hytd1, hytd2: row.hytd2, ytd: row.ytd };
}

export function buildMasterUnitSheet(units: UnitMaster[], summary?: SummaryReport): XLSX.WorkSheet {
  const now = summary ? summaryAsOfDate(summary.asOf) : new Date();
  const unitHours = new Map((summary?.units || []).map((row) => [row.unit.trim().toLowerCase(), summaryHours(row)]));
  const groupHours = new Map((summary?.groups || []).map((row) => [row.label.trim().toLowerCase(), summaryHours(row)]));
  const groups = ["Model", "Quota Hrs", "Unit"];
  const details = ["", "", ""];
  for (const period of PERIODS) {
    groups.push(MASTER_PERIOD_LABEL[period], "", "");
    details.push("Quota Hrs", "Jam", "Sisa");
  }
  groups.push("Group", "Quota Hrs (GROUP)");
  details.push("", "");
  for (const period of PERIODS) {
    groups.push(MASTER_PERIOD_LABEL[period], "", "");
    details.push("Quota Hrs", "Jam", "Sisa");
  }
  const body = units.map((unit) => {
    const grouped = unit.group.trim();
    return [
      unit.model,
      summaryNumber(unit.quota_hrs),
      unit.unit,
      ...periodValueCells(unit.quota_hrs, summary ? unitHours.get(unit.unit.trim().toLowerCase()) ?? summaryHours(undefined) : null, now),
      grouped,
      grouped ? summaryNumber(unit.group_quota_hrs) : "",
      ...periodValueCells(grouped ? unit.group_quota_hrs : null, grouped && summary ? groupHours.get(grouped.toLowerCase()) ?? summaryHours(undefined) : null, now),
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([groups, details, ...body]);
  const unitPeriodStart = 3;
  const groupColumn = unitPeriodStart + PERIODS.length * 3;
  const groupPeriodStart = groupColumn + 2;
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
    { s: { r: 0, c: groupColumn }, e: { r: 1, c: groupColumn } },
    { s: { r: 0, c: groupColumn + 1 }, e: { r: 1, c: groupColumn + 1 } },
  ];
  PERIODS.forEach((_, index) => {
    merges.push({ s: { r: 0, c: unitPeriodStart + index * 3 }, e: { r: 0, c: unitPeriodStart + index * 3 + 2 } });
    merges.push({ s: { r: 0, c: groupPeriodStart + index * 3 }, e: { r: 0, c: groupPeriodStart + index * 3 + 2 } });
  });
  sheet["!merges"] = merges;
  sheet["!cols"] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    ...Array.from({ length: PERIODS.length * 3 }, () => ({ wch: 12 })),
    { wch: 14 },
    { wch: 18 },
    ...Array.from({ length: PERIODS.length * 3 }, () => ({ wch: 12 })),
  ];
  const width = groups.length - 1;
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let row = 2; row <= range.e.r; row += 1) {
    for (let column = 0; column <= width; column += 1) {
      if (column === 0 || column === 2 || column === groupColumn) continue;
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = "0.00";
    }
  }
  fillGrid(sheet, 0, Math.max(range.e.r, 1), 0, width);
  return sheet;
}

export async function downloadMasterUnitExcel(input: { units: UnitMaster[]; summary?: SummaryReport }) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, buildMasterUnitSheet(input.units, input.summary), "Master unit");
  const blob = await workbookBlob(book);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(new Date(), "Export Master Unit Armor");
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadHandoverExcel(input: {
  date: string;
  shift: string;
  rows: HandoverRow[];
  now: Date;
  query: string;
  sisa?: Map<string, SisaCell[]>;
  summary?: SummaryReport;
}) {
  const book = buildHandoverWorkbook(input);
  const blob = await workbookBlob(book);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName();
  link.click();
  URL.revokeObjectURL(url);
}
