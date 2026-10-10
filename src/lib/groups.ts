import { parseQuota } from "@/lib/units";

export type UnitGroup = {
  id: string;
  group: string;
  quota_hrs: number;
};

export type UnitGroupInput = {
  group: string;
  quota_hrs: number;
};

export function validateGroupInput(input: { group: string; quota: string }): string | null {
  if (!input.group.trim()) return "Group wajib diisi";
  if (input.group.trim().length > 128) return "Group terlalu panjang";
  if (parseQuota(input.quota) == null) return "Quota Hrs harus angka";
  return null;
}
