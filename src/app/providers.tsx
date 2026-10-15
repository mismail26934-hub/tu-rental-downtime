"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { del, get, set } from "idb-keyval";
import { AppFrame } from "@/components/AppFrame";
import { LiveSync } from "@/components/LiveSync";
import { hydrateOutbox } from "@/lib/offline/outbox";
import { bindQueryClient, shouldHoldServerRefresh, startOutboxSync } from "@/lib/offline/sync";

const CACHE_KEY = "tu-rental-query";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const ReadyContext = createContext(false);

export function useOfflineReady() {
  return useContext(ReadyContext);
}

const noopStorage = {
  getItem: async () => null as string | null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: MAX_AGE_MS,
        refetchOnWindowFocus: () => !shouldHoldServerRefresh(),
        refetchOnReconnect: () => !shouldHoldServerRefresh(),
        refetchOnMount: () => !shouldHoldServerRefresh(),
        retry: (count) => !shouldHoldServerRefresh() && count < 1,
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "always",
        retry: 0,
      },
    },
  });
}

const idbStorage = {
  getItem: async (key: string) => {
    const value = await get(key);
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    }
    return null;
  },
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

function getPersister() {
  if (typeof window === "undefined") {
    return createAsyncStoragePersister({ storage: noopStorage, key: CACHE_KEY });
  }
  return createAsyncStoragePersister({
    storage: idbStorage,
    key: CACHE_KEY,
    throttleTime: 100,
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(getPersister);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    bindQueryClient(queryClient);
    void hydrateOutbox().finally(() => {
      if (cancel) return;
      startOutboxSync();
      setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, [queryClient]);

  return (
    <SessionProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: MAX_AGE_MS, buster: "v1" }}
      >
        <LiveSync />
        <ReadyContext.Provider value={ready}>
          <AppFrame>{children}</AppFrame>
        </ReadyContext.Provider>
        <ReactQueryDevtools initialIsOpen={false} />
      </PersistQueryClientProvider>
    </SessionProvider>
  );
}
