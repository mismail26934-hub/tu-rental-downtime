import { create } from "zustand";
import { persist } from "zustand/middleware";

type WaScheduleViewState = {
  enabled: boolean;
  intervalMinutes: number;
  activeFrom: string;
  activeUntil: string;
  setSchedule: (patch: Partial<Pick<WaScheduleViewState, "enabled" | "intervalMinutes" | "activeFrom" | "activeUntil">>) => void;
};

export const useWaScheduleView = create<WaScheduleViewState>()(
  persist(
    (set) => ({
      enabled: false,
      intervalMinutes: 60,
      activeFrom: "06:00",
      activeUntil: "22:00",
      setSchedule: (patch) => set(patch),
    }),
    { name: "tu-rental-wa-schedule", skipHydration: true }
  )
);

export function rehydrateWaScheduleView() {
  return useWaScheduleView.persist.rehydrate();
}
