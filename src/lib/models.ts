export type UnitModel = {
  id: string;
  model: string;
};

export type UnitModelInput = {
  model: string;
};

export function validateModelInput(input: { model: string }): string | null {
  if (!input.model.trim()) return "Model wajib diisi";
  if (input.model.trim().length > 64) return "Model terlalu panjang";
  return null;
}
