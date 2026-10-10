import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardViewState = {
  editMode: boolean;
  setEditMode: (editMode: boolean) => void;
};

export const useBoardView = create<BoardViewState>()(
  persist(
    (set) => ({
      editMode: false,
      setEditMode: (editMode) => set({ editMode }),
    }),
    { name: "tu-rental-edit-mode", skipHydration: true }
  )
);
