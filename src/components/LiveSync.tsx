"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { LiveTopic } from "@/lib/live";
import { shouldHoldServerRefresh } from "@/lib/offline/sync";

const QUERY_KEYS: Record<LiveTopic, string[][]> = {
  board: [["board"], ["dt-summary"], ["backups"]],
  units: [["units"], ["dt-summary"], ["backups"]],
  groups: [["groups"], ["units"], ["dt-summary"], ["backups"]],
  users: [["users"]],
};

function isTopic(value: string): value is LiveTopic {
  return value === "board" || value === "units" || value === "groups" || value === "users";
}

export function LiveSync() {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const deferred = new Set<LiveTopic>();
    let source: EventSource | null = null;
    let stopped = false;

    const flush = (topic: LiveTopic) => {
      for (const queryKey of QUERY_KEYS[topic]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const onChange = (event: Event) => {
      let topic = "";
      try {
        topic = String(JSON.parse((event as MessageEvent).data).topic || "");
      } catch {
        return;
      }
      if (!isTopic(topic)) return;
      if (shouldHoldServerRefresh()) {
        deferred.add(topic);
        return;
      }
      flush(topic);
    };

    const connect = () => {
      if (stopped || !navigator.onLine) return;
      if (source && source.readyState !== EventSource.CLOSED) return;
      source = new EventSource("/api/live");
      source.addEventListener("change", onChange);
    };

    connect();
    const timer = window.setInterval(() => {
      if (!shouldHoldServerRefresh() && deferred.size > 0) {
        const topics = [...deferred];
        deferred.clear();
        topics.forEach(flush);
      }
      if (!source || source.readyState === EventSource.CLOSED) connect();
    }, 2000);
    window.addEventListener("online", connect);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("online", connect);
      source?.close();
    };
  }, [queryClient, status]);

  return null;
}
