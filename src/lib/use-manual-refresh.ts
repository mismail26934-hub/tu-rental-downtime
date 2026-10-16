import { useCallback, useState } from "react";

/** Tracks user-triggered refresh so shimmer can show without reacting to polling. */
export function useManualRefresh() {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback((run: () => void | Promise<unknown>) => {
    setRefreshing(true);
    void Promise.resolve(run()).finally(() => setRefreshing(false));
  }, []);

  return { refreshing, refresh };
}
