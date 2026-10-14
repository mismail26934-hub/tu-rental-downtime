import * as XLSX from "xlsx";
import { parseQuota } from "@/lib/units";

const MAX_ROWS = 300;

export const GROUP_TEMPLATE_HEADERS = ["Group", "Quota Hrs"] as const;
export const MASTER_UNIT_TEMPLATE_HEADERS = ["Model", "Quota Hrs", "Unit", "Group"] as const;

export type ParsedGroupRow = {
  line: number;
  group: string;
  quota: string;
  quota_hrs: number;
};

export type ParsedMasterUnitRow = {
  line: number;
  model: string;
  quota: string;
  quota_hrs: number;
  unit: string;
  group: string;
};

function headerKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

function findHeaderRow(
  grid: unknown[][],
  required: string[]
): { index: number; columns: Record<string, number> } | null {
  for (let index = 0; index < Math.min(grid.length, 20); index += 1) {
    const keys = (grid[index] || []).map(headerKey);
    const columns: Record<string, number> = {};
    let ok = true;
    for (const name of required) {
      const column = keys.findIndex((key) => key === name);
      if (column < 0) {
        ok = false;
        break;
      }
      columns[name] = column;
    }
    if (ok) return { index, columns };
  }
  return null;
}

function readFirstSheet(data: ArrayBuffer | Uint8Array): unknown[][] | null {
  const book = XLSX.read(data, { type: "array" });
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  }
  return null;
}

export function parseGroupWorkbook(data: ArrayBuffer | Uint8Array): {
  rows: ParsedGroupRow[];
  error: string | null;
} {
  const grid = readFirstSheet(data);
  if (!grid) return { rows: [], error: "File Excel tidak bisa dibaca." };
  const header = findHeaderRow(grid, ["group", "quota hrs"]);
  if (!header) {
    return { rows: [], error: "Kolom tidak dikenali. Pakai template Group + Quota Hrs." };
  }

  const rows: ParsedGroupRow[] = [];
  for (let index = header.index + 1; index < grid.length; index += 1) {
    const cells = grid[index] || [];
    const group = textFromCell(cells[header.columns.group]);
    const quota = textFromCell(cells[header.columns["quota hrs"]]);
    if (!group && !quota) continue;
    const quota_hrs = parseQuota(quota);
    rows.push({
      line: index + 1,
      group,
      quota,
      quota_hrs: quota_hrs ?? Number.NaN,
    });
  }
  if (!rows.length) return { rows: [], error: "Tidak ada baris group di file." };
  return { rows: rows.slice(0, MAX_ROWS), error: null };
}

export function parseMasterUnitWorkbook(data: ArrayBuffer | Uint8Array): {
  rows: ParsedMasterUnitRow[];
  error: string | null;
} {
  const grid = readFirstSheet(data);
  if (!grid) return { rows: [], error: "File Excel tidak bisa dibaca." };

  // Template: Model | Quota Hrs | Unit | Group (Group boleh kosong / tidak ada)
  let header = findHeaderRow(grid, ["model", "quota hrs", "unit"]);
  let dataStart = header ? header.index + 1 : -1;

  // Export Master unit: row0 has Model/Quota Hrs/Unit/.../Group, row1 is detail labels
  if (!header) {
    const first = (grid[0] || []).map(headerKey);
    const modelCol = first.indexOf("model");
    const quotaCol = first.indexOf("quota hrs");
    const unitCol = first.indexOf("unit");
    if (modelCol >= 0 && quotaCol >= 0 && unitCol >= 0) {
      header = {
        index: 0,
        columns: {
          model: modelCol,
          "quota hrs": quotaCol,
          unit: unitCol,
        },
      };
      const groupCol = first.indexOf("group");
      if (groupCol >= 0) header.columns.group = groupCol;
      const second = (grid[1] || []).map(headerKey);
      dataStart = second.includes("quota hrs") || second.includes("jam") || second.includes("sisa") ? 2 : 1;
    }
  } else {
    const keys = (grid[header.index] || []).map(headerKey);
    const groupCol = keys.findIndex((key) => key === "group");
    if (groupCol >= 0) header.columns.group = groupCol;
  }

  if (!header || dataStart < 0) {
    return {
      rows: [],
      error: "Kolom tidak dikenali. Pakai template atau file Export Master unit.",
    };
  }

  const rows: ParsedMasterUnitRow[] = [];
  for (let index = dataStart; index < grid.length; index += 1) {
    const cells = grid[index] || [];
    const model = textFromCell(cells[header.columns.model]);
    const quota = textFromCell(cells[header.columns["quota hrs"]]);
    const unit = textFromCell(cells[header.columns.unit]).replace(/\*$/, "").trim();
    const groupCol = header.columns.group;
    const group = groupCol == null ? "" : textFromCell(cells[groupCol]);
    if (!model && !quota && !unit && !group) continue;
    const quota_hrs = parseQuota(quota);
    rows.push({
      line: index + 1,
      model,
      quota,
      quota_hrs: quota_hrs ?? Number.NaN,
      unit,
      group,
    });
  }
  if (!rows.length) return { rows: [], error: "Tidak ada baris unit di file." };
  return { rows: rows.slice(0, MAX_ROWS), error: null };
}

export function downloadGroupTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([[...GROUP_TEMPLATE_HEADERS]]);
  sheet["!cols"] = GROUP_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Group");
  XLSX.writeFile(book, "Template Master Group.xlsx");
}

export function downloadMasterUnitTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([[...MASTER_UNIT_TEMPLATE_HEADERS]]);
  sheet["!cols"] = MASTER_UNIT_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Unit");
  XLSX.writeFile(book, "Template Master Unit.xlsx");
}
