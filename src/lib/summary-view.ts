import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SummaryMetric = "quota" | "jam" | "sisa";

export type SummaryColumns = Record<SummaryMetric, boolean>;

type SummaryViewState = {
  columns: SummaryColumns;
  setColumn: (metric: SummaryMetric, shown: boolean) => void;
};

const initialColumns: SummaryColumns = { quota: true, jam: true, sisa: true };

export const useSummaryView = create<SummaryViewState>()(
  persist(
    (set, get) => ({
      columns: initialColumns,
      setColumn: (metric, shown) => {
        const columns = { ...get().columns, [metric]: shown };
        if (!columns.quota && !columns.jam && !columns.sisa) return;
        set({ columns });
      },
    }),
    { name: "tu-rental-summary-columns", skipHydration: true }
  )
);

export function dailyColumnCount(columns: SummaryColumns): number {
  return Number(columns.jam) + Number(columns.sisa);
}

export function periodColumnCount(columns: SummaryColumns): number {
  return Number(columns.quota) + Number(columns.jam) + Number(columns.sisa);
}
