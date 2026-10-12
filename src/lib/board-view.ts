import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardViewState = {
  editMode: boolean;
  summaryHidden: boolean;
  tableHidden: boolean;
  setEditMode: (editMode: boolean) => void;
  setSummaryHidden: (hidden: boolean) => void;
  setTableHidden: (hidden: boolean) => void;
};

export const useBoardView = create<BoardViewState>()(
  persist(
    (set) => ({
      editMode: false,
      summaryHidden: false,
      tableHidden: false,
      setEditMode: (editMode) => set({ editMode }),
      setSummaryHidden: (summaryHidden) => set({ summaryHidden }),
      setTableHidden: (tableHidden) => set({ tableHidden }),
    }),
    { name: "tu-rental-edit-mode", skipHydration: true }
  )
);
