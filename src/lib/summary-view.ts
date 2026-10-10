import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SummaryMetric = "quota" | "jam" | "sisa";

export type SummaryColumns = Record<SummaryMetric, boolean>;

export type SummaryUnit = "jam" | "hari";

export const HOURS_PER_DAY = 24;

type SummaryViewState = {
  columns: SummaryColumns;
  unit: SummaryUnit;
  setColumn: (metric: SummaryMetric, shown: boolean) => void;
  setUnit: (unit: SummaryUnit) => void;
};

const initialColumns: SummaryColumns = { quota: true, jam: true, sisa: true };

export const useSummaryView = create<SummaryViewState>()(
  persist(
    (set, get) => ({
      columns: initialColumns,
      unit: "jam",
      setColumn: (metric, shown) => {
        const columns = { ...get().columns, [metric]: shown };
        if (!columns.quota && !columns.jam && !columns.sisa) return;
        set({ columns });
      },
      setUnit: (unit) => set({ unit }),
    }),
    { name: "tu-rental-summary-columns", skipHydration: true }
  )
);

export function toSummaryAmount(value: number | null, unit: SummaryUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (unit === "jam") return value;
  return value / HOURS_PER_DAY;
}

export function dailyColumnCount(columns: SummaryColumns): number {
  return Number(columns.jam) + Number(columns.sisa);
}

export function periodColumnCount(columns: SummaryColumns): number {
  return Number(columns.quota) + Number(columns.jam) + Number(columns.sisa);
}
