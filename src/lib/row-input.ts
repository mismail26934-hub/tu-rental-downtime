import { deriveStatus, parseHm, parseLocal } from "@/lib/calc";
import { emptyRowInput, type RowInput } from "@/lib/types";

const LIMITS: Record<keyof RowInput, number> = {
  crew: 64,
  unit: 128,
  location: 255,
  technician: 255,
  status: 32,
  waiting_labour_at: 64,
  repair_started_at: 64,
  rd30_at: 64,
  hm_awal: 64,
  hm_akhir: 64,
  unit_backup: 128,
  backup_time: 64,
  breakdown_problem: 8000,
  done_action: 8000,
  continue_handover: 8000,
  so: 8000,
};

export function sameRowInput(left: RowInput, right: RowInput): boolean {
  const a = normalizeRowInput(left);
  const b = normalizeRowInput(right);
  if (!a || !b) return false;
  return (Object.keys(a) as (keyof RowInput)[]).every((key) => a[key] === b[key]);
}

export function normalizeRowInput(body: unknown): RowInput | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const row = emptyRowInput();
  (Object.keys(LIMITS) as (keyof RowInput)[]).forEach((key) => {
    const raw = source[key];
    const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
    row[key] = text.slice(0, LIMITS[key]);
  });
  row.status = deriveStatus(row);
  return row;
}

const HM_AWAL_NUMBER = "HM awal harus angka";
const HM_AKHIR_NUMBER = "HM akhir harus angka";
const HM_ORDER = "HM akhir tidak boleh lebih kecil dari HM awal";

function isIncompleteNumber(value: string): boolean {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "-" || trimmed === "." || trimmed === "-." || /^-?\d+\.$/.test(trimmed);
}

function integerDigits(value: string): number {
  const match = /^-?(\d+)/.exec(value.trim().replace(",", "."));
  return match ? match[1].length : 0;
}

export function hmLiveError(input: Pick<RowInput, "hm_awal" | "hm_akhir">, whileTyping = false): string | null {
  if (input.hm_awal.trim() && !isIncompleteNumber(input.hm_awal) && parseHm(input.hm_awal) == null) {
    return HM_AWAL_NUMBER;
  }
  if (input.hm_akhir.trim() && !isIncompleteNumber(input.hm_akhir) && parseHm(input.hm_akhir) == null) {
    return HM_AKHIR_NUMBER;
  }
  const hmAwal = parseHm(input.hm_awal);
  const hmAkhir = parseHm(input.hm_akhir);
  if (hmAwal != null && hmAkhir != null && hmAkhir < hmAwal) {
    if (whileTyping && integerDigits(input.hm_akhir) < integerDigits(input.hm_awal)) return null;
    return HM_ORDER;
  }
  return null;
}

export function isHmValidationMessage(message: string): boolean {
  return message === HM_AWAL_NUMBER || message === HM_AKHIR_NUMBER || message === HM_ORDER;
}

export function validateRowInput(input: RowInput): string | null {
  if (!input.crew.trim()) return "Crew wajib diisi";
  if (!input.unit.trim()) return "Unit wajib diisi";
  if (!input.waiting_labour_at.trim()) return "Waiting Labour wajib diisi";
  const stamps = ["waiting_labour_at", "repair_started_at", "rd30_at", "backup_time"] as const;
  for (const key of stamps) {
    if (input[key] && parseLocal(input[key]) == null) return "Format waktu harus dd/mm/yyyy hh:mm";
  }
  if (input.hm_awal.trim() && parseHm(input.hm_awal) == null) return HM_AWAL_NUMBER;
  if (input.hm_akhir.trim() && parseHm(input.hm_akhir) == null) return HM_AKHIR_NUMBER;
  const hmAwal = parseHm(input.hm_awal);
  const hmAkhir = parseHm(input.hm_akhir);
  if (hmAwal != null && hmAkhir != null && hmAkhir < hmAwal) return HM_ORDER;
  return null;
}

export function isSheetDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isRowId(value: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(value);
}
