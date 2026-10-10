export type UnitMaster = {
  id: string;
  model: string;
  quota_hrs: number;
  unit: string;
  group: string;
  group_quota_hrs: number | null;
};

export type UnitInput = {
  model: string;
  quota_hrs: number;
  unit: string;
  group: string;
};

export function formatQuota(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

export function parseQuota(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number < 0 || number > 999999) return null;
  return Math.round(number * 100) / 100;
}

export function validateUnitInput(input: { model: string; quota: string; unit: string; group: string }): string | null {
  if (!input.model.trim()) return "Model wajib diisi";
  if (input.model.trim().length > 64) return "Model terlalu panjang";
  if (parseQuota(input.quota) == null) return "Quota Hrs harus angka";
  if (!input.unit.trim()) return "Unit wajib diisi";
  if (input.unit.trim().length > 128) return "Unit terlalu panjang";
  if (input.group.trim().length > 128) return "Group terlalu panjang";
  return null;
}
