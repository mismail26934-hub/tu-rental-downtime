import { create } from "zustand";
import { persist } from "zustand/middleware";

type MasterViewState = {
  cardsHidden: boolean;
  tableHidden: boolean;
  setCardsHidden: (hidden: boolean) => void;
  setTableHidden: (hidden: boolean) => void;
};

const STORE_KEY = "tu-rental-master-view";
const LEGACY_CARDS_KEY = "tu-rental-hide-model-cards";

export const useMasterView = create<MasterViewState>()(
  persist(
    (set) => ({
      cardsHidden: false,
      tableHidden: false,
      setCardsHidden: (cardsHidden) => set({ cardsHidden }),
      setTableHidden: (tableHidden) => set({ tableHidden }),
    }),
    { name: STORE_KEY, skipHydration: true }
  )
);

export async function rehydrateMasterView() {
  let hadStore = false;
  let legacy: string | null = null;
  try {
    hadStore = localStorage.getItem(STORE_KEY) != null;
    legacy = localStorage.getItem(LEGACY_CARDS_KEY);
  } catch {
    /* ignore */
  }
  await useMasterView.persist.rehydrate();
  if (!hadStore && legacy === "1") useMasterView.getState().setCardsHidden(true);
  if (legacy == null) return;
  try {
    localStorage.removeItem(LEGACY_CARDS_KEY);
  } catch {
    /* ignore */
  }
}
