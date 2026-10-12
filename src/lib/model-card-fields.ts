import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CARD_FIELDS = ["units", "daily", "quota", "jam", "wtd", "mtd", "hytd1", "hytd2", "ytd"] as const;

export type CardField = (typeof CARD_FIELDS)[number];

export type CardFieldState = Record<CardField, boolean>;

type ModelCardFieldStore = CardFieldState & {
  setField: (field: CardField, shown: boolean) => void;
};

export const CARD_FIELD_LABEL: Record<CardField, string> = {
  units: "Unit",
  daily: "Sisa Daily",
  quota: "Quota",
  jam: "Jam",
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

const initialFields: CardFieldState = {
  units: true,
  daily: true,
  quota: true,
  jam: true,
  wtd: true,
  mtd: true,
  hytd1: true,
  hytd2: true,
  ytd: true,
};

export const useModelCardFields = create<ModelCardFieldStore>()(
  persist(
    (set) => ({
      ...initialFields,
      setField: (field, shown) => set({ [field]: shown }),
    }),
    { name: "tu-rental-model-card-fields", skipHydration: true }
  )
);

export function rehydrateModelCardFields() {
  return useModelCardFields.persist.rehydrate();
}
