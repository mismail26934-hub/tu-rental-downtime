import * as XLSX from "xlsx";
import { parseLocal } from "@/lib/calc";
import { parseDateTimeDMY } from "@/lib/format";
import { emptyRowInput, type RowInput } from "@/lib/types";

export const UNIT_TEMPLATE_HEADERS = [
  "Crew",
  "Unit",
  "Location",
  "Technician",
  "Waiting Labour",
  "Repair Time",
  "RD30",
  "HM awal",
  "HM akhir",
  "Unit Back up",
  "Back up time",
  "Breakdown problem",
  "Done / Action",
  "Continue / Handover",
  "SO",
] as const;

const TIME_FIELDS = ["waiting_labour_at", "repair_started_at", "rd30_at", "backup_time"] as const;
const HM_FIELDS = ["hm_awal", "hm_akhir"] as const;

const FIELD_HEADERS: { field: keyof RowInput; header: string }[] = [
  { field: "crew", header: "crew" },
  { field: "unit", header: "unit" },
  { field: "location", header: "location" },
  { field: "technician", header: "technician" },
  { field: "waiting_labour_at", header: "waiting labour" },
  { field: "repair_started_at", header: "repair time" },
  { field: "rd30_at", header: "rd30" },
  { field: "hm_awal", header: "hm awal" },
  { field: "hm_akhir", header: "hm akhir" },
  { field: "unit_backup", header: "unit back up" },
  { field: "backup_time", header: "back up time" },
  { field: "breakdown_problem", header: "breakdown problem" },
  { field: "done_action", header: "done / action" },
  { field: "continue_handover", header: "continue / handover" },
  { field: "so", header: "so" },
];

export type ParsedUnitRow = {
  line: number;
  input: RowInput;
};

function headerKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function stampFromCell(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}T${pad(parsed.H)}:${pad(parsed.M)}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "-") return "";
  const dmy = parseDateTimeDMY(text);
  if (dmy) return dmy;
  if (parseLocal(text) != null) return text.replace(" ", "T").slice(0, 16);
  return text;
}

function textFromCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }
  const text = String(value).trim();
  if (text === "—" || text === "-") return "";
  return text;
}

function columnMap(header: unknown[]): Partial<Record<keyof RowInput, number>> | null {
  const used = new Set<number>();
  const map: Partial<Record<keyof RowInput, number>> = {};
  const keys = header.map(headerKey);
  for (const item of FIELD_HEADERS) {
    const index = keys.findIndex((key, column) => key === item.header && !used.has(column));
    if (index >= 0) {
      map[item.field] = index;
      used.add(index);
    }
  }
  if (map.unit == null || map.crew == null || map.waiting_labour_at == null) return null;
  return map;
}

export function parseUnitWorkbook(data: ArrayBuffer | Uint8Array): { rows: ParsedUnitRow[]; error: string | null } {
  const book = XLSX.read(data, { type: "array" });
  let found: { grid: unknown[][]; headerIndex: number; columns: Partial<Record<keyof RowInput, number>> } | null = null;
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    for (let index = 0; index < Math.min(grid.length, 20); index += 1) {
      const columns = columnMap(grid[index] || []);
      if (columns) {
        found = { grid, headerIndex: index, columns };
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    return {
      rows: [],
      error: "Kolom tidak dikenali. Pakai template atau file Export dari Daftar Unit.",
    };
  }

  const rows: ParsedUnitRow[] = [];
  for (let index = found.headerIndex + 1; index < found.grid.length; index += 1) {
    const cells = found.grid[index] || [];
    const input = emptyRowInput();
    (Object.keys(found.columns) as (keyof RowInput)[]).forEach((field) => {
      const column = found.columns[field];
      if (column == null) return;
      const value = cells[column];
      if (TIME_FIELDS.includes(field as (typeof TIME_FIELDS)[number])) input[field] = stampFromCell(value);
      else if (HM_FIELDS.includes(field as (typeof HM_FIELDS)[number])) input[field] = textFromCell(value);
      else input[field] = textFromCell(value);
    });
    input.unit = input.unit.replace(/\*$/, "").trim();
    input.unit_backup = input.unit_backup.replace(/\*$/, "").trim();
    const blank = (Object.keys(input) as (keyof RowInput)[]).every((key) => !input[key].trim());
    if (blank) continue;
    rows.push({ line: index + 1, input });
  }
  if (!rows.length) return { rows: [], error: "Tidak ada baris unit di file." };
  return { rows: rows.slice(0, 300), error: null };
}

export function downloadUnitTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([[...UNIT_TEMPLATE_HEADERS]]);
  sheet["!cols"] = UNIT_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(header.length + 2, 16) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Unit");
  XLSX.writeFile(book, "Template Tambah Unit.xlsx");
}
