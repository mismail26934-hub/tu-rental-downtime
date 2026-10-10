import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { todayISO } from "@/lib/format";

type SheetYearState = {
  year: string;
  setYear: (year: string) => void;
};

const YEAR_KEY = "tu-rental-year";

export const useSheetYear = create<SheetYearState>()(
  persist(
    (set) => ({
      year: todayISO().slice(0, 4),
      setYear: (year) => set({ year }),
    }),
    {
      name: YEAR_KEY,
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: () => {
          const year = localStorage.getItem(YEAR_KEY);
          if (!year || !/^\d{4}$/.test(year)) return null;
          return JSON.stringify({ state: { year }, version: 0 });
        },
        setItem: (_name, value) => {
          const parsed = JSON.parse(value) as { state?: { year?: string } };
          const year = parsed.state?.year ?? "";
          if (/^\d{4}$/.test(year)) localStorage.setItem(YEAR_KEY, year);
        },
        removeItem: () => localStorage.removeItem(YEAR_KEY),
      })),
    }
  )
);

export function yearChoices(selected: string, years: number[]): string[] {
  const values = new Set<number>([Number(selected), new Date().getFullYear(), ...years]);
  return [...values]
    .filter((value) => Number.isInteger(value) && value >= 2000)
    .sort((a, b) => b - a)
    .map(String);
}
