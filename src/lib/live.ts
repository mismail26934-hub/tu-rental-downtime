export type LiveTopic = "board" | "units" | "groups" | "models" | "users";

type Listener = (topic: LiveTopic) => void;

type LiveHub = {
  listeners: Set<Listener>;
};

const globalLive = globalThis as typeof globalThis & { __tuRentalLive?: LiveHub };

function hub(): LiveHub {
  if (!globalLive.__tuRentalLive) {
    globalLive.__tuRentalLive = { listeners: new Set() };
  }
  return globalLive.__tuRentalLive;
}

export function publishLive(topic: LiveTopic) {
  for (const listener of hub().listeners) listener(topic);
}

export function subscribeLive(listener: Listener) {
  const listeners = hub().listeners;
  listeners.add(listener);
  return () => listeners.delete(listener);
}
