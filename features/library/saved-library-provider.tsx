"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Song } from "@/lib/domain/catalog";
import { savedKey, type SavedIsrc } from "@/lib/storage/saved-schema";
import { getSavedRepository, type SavedRepository } from "@/lib/storage/saved-repository";

type SavedLibraryValue = {
  records: SavedIsrc[];
  loading: boolean;
  persistent: boolean;
  ignoredCount: number;
  busyCodes: ReadonlySet<string>;
  isSaved(code: string): boolean;
  toggle(song: Song, code: string): Promise<{ saved: boolean; persistent: boolean }>;
  remove(code: string): Promise<{ persistent: boolean }>;
};

const SavedLibraryContext = createContext<SavedLibraryValue | null>(null);

export function SavedLibraryProvider({ children, repository = getSavedRepository() }: {
  children: React.ReactNode;
  repository?: SavedRepository;
}) {
  const [records, setRecords] = useState<SavedIsrc[]>([]);
  const [loading, setLoading] = useState(true);
  const [persistent, setPersistent] = useState(true);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [busyCodes, setBusyCodes] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    const result = await repository.list();
    setRecords(result.records);
    setPersistent(result.persistent);
    setIgnoredCount(result.ignoredCount);
  }, [repository]);

  useEffect(() => {
    let active = true;
    void repository.migrateLegacy()
      .then(() => repository.list())
      .then((result) => {
        if (!active) return;
        setRecords(result.records);
        setPersistent(result.persistent);
        setIgnoredCount(result.ignoredCount);
      })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = repository.subscribe(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [refresh, repository]);

  const keys = useMemo(() => new Set(records.map((record) => record.key)), [records]);

  const runBusy = useCallback(async <T,>(code: string, action: () => Promise<T>) => {
    const key = savedKey(code);
    if (!key) throw new Error("INVALID_ISRC");
    setBusyCodes((current) => new Set(current).add(key));
    try {
      return await action();
    } finally {
      setBusyCodes((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const value = useMemo<SavedLibraryValue>(() => ({
    records,
    loading,
    persistent,
    ignoredCount,
    busyCodes,
    isSaved: (code) => {
      const key = savedKey(code);
      return key ? keys.has(key) : false;
    },
    toggle: async (song, code) => runBusy(code, async () => {
      const key = savedKey(code);
      const wasSaved = key ? keys.has(key) : false;
      const result = wasSaved ? await repository.remove(code) : await repository.save(song, code);
      setRecords(result.records);
      setPersistent(result.persistent);
      return { saved: !wasSaved, persistent: result.persistent };
    }),
    remove: async (code) => runBusy(code, async () => {
      const result = await repository.remove(code);
      setRecords(result.records);
      setPersistent(result.persistent);
      return { persistent: result.persistent };
    }),
  }), [busyCodes, ignoredCount, keys, loading, persistent, records, repository, runBusy]);

  return <SavedLibraryContext.Provider value={value}>{children}</SavedLibraryContext.Provider>;
}

export function useSavedLibrary(): SavedLibraryValue {
  const value = useContext(SavedLibraryContext);
  if (!value) throw new Error("useSavedLibrary must be used within SavedLibraryProvider.");
  return value;
}
