const inflight = new Map<string, Promise<unknown>>();

export function shareInFlight<T>(key: string, start: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = start().finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

export function resetInFlightForTests(): void {
  inflight.clear();
}
