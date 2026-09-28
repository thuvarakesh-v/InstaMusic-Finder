import "client-only";

import { z } from "zod";

import type { Song } from "@/lib/domain/catalog";
import { normalizeIsrc } from "@/lib/domain/isrc";

import { createSavedIsrc, savedIsrcSchema, savedKey, type SavedIsrc } from "./saved-schema";

const DB_NAME = "instamusic-code";
const DB_VERSION = 1;
const SAVED_STORE = "saved";
const META_STORE = "meta";
const HISTORY_STORE = "history";
const MAX_SAVED = 1_000;
const LEGACY_KEY = "isrc-finder-saved-tracks";
const MIGRATION_KEY = "migration:legacy-saved:v1";
const CHANNEL_NAME = "instamusic-code:saved:v1";

export type SavedListResult = { records: SavedIsrc[]; persistent: boolean; ignoredCount: number };
export type SavedMutationResult = { records: SavedIsrc[]; persistent: boolean };

export interface SavedRepository {
  list(): Promise<SavedListResult>;
  save(song: Song, code: string): Promise<SavedMutationResult>;
  remove(code: string): Promise<SavedMutationResult>;
  clear(): Promise<SavedMutationResult>;
  migrateLegacy(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

class BrowserSavedRepository implements SavedRepository {
  private readonly memory = new Map<string, SavedIsrc>();

  async list(): Promise<SavedListResult> {
    try {
      const database = await openDatabase();
      const raw = await request(database.transaction(SAVED_STORE, "readonly").objectStore(SAVED_STORE).getAll());
      const records: SavedIsrc[] = [];
      let ignoredCount = 0;
      for (const candidate of raw) {
        const parsed = savedIsrcSchema.safeParse(candidate);
        if (parsed.success) {
          records.push(parsed.data);
          this.memory.set(parsed.data.key, parsed.data);
        } else {
          ignoredCount += 1;
        }
      }
      return { records: sortRecords(records), persistent: true, ignoredCount };
    } catch {
      return { records: sortRecords([...this.memory.values()]), persistent: false, ignoredCount: 0 };
    }
  }

  async save(song: Song, code: string): Promise<SavedMutationResult> {
    const key = savedKey(code);
    if (!key) throw new Error("INVALID_ISRC");
    try {
      const database = await openDatabase();
      const existingRaw = await request(database.transaction(SAVED_STORE, "readonly").objectStore(SAVED_STORE).get(key));
      const existing = savedIsrcSchema.safeParse(existingRaw);
      const count = await request(database.transaction(SAVED_STORE, "readonly").objectStore(SAVED_STORE).count());
      if (!existing.success && count >= MAX_SAVED) throw new SavedStorageLimitError();
      const record = createSavedIsrc(song, code, existing.success ? existing.data : undefined);
      const transaction = database.transaction(SAVED_STORE, "readwrite");
      const store = transaction.objectStore(SAVED_STORE);
      store.put(record);
      await transactionDone(transaction);
      this.memory.set(record.key, record);
      this.notify();
      return { records: (await this.list()).records, persistent: true };
    } catch (error) {
      if (error instanceof SavedStorageLimitError) throw error;
      const existing = this.memory.get(key);
      const record = createSavedIsrc(song, code, existing);
      this.memory.set(key, record);
      return { records: sortRecords([...this.memory.values()]), persistent: false };
    }
  }

  async remove(code: string): Promise<SavedMutationResult> {
    const key = savedKey(code);
    if (!key) throw new Error("INVALID_ISRC");
    this.memory.delete(key);
    try {
      const database = await openDatabase();
      const transaction = database.transaction(SAVED_STORE, "readwrite");
      transaction.objectStore(SAVED_STORE).delete(key);
      await transactionDone(transaction);
      this.notify();
      return { records: (await this.list()).records, persistent: true };
    } catch {
      return { records: sortRecords([...this.memory.values()]), persistent: false };
    }
  }

  async clear(): Promise<SavedMutationResult> {
    this.memory.clear();
    try {
      const database = await openDatabase();
      const transaction = database.transaction(SAVED_STORE, "readwrite");
      transaction.objectStore(SAVED_STORE).clear();
      await transactionDone(transaction);
      this.notify();
      return { records: [], persistent: true };
    } catch {
      return { records: [], persistent: false };
    }
  }

  async migrateLegacy(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const database = await openDatabase();
      const migration = await request(database.transaction(META_STORE, "readonly").objectStore(META_STORE).get(MIGRATION_KEY));
      if (migration) return;
      const raw = window.localStorage.getItem(LEGACY_KEY);
      const parsed = legacyTracksSchema.safeParse(raw ? JSON.parse(raw) : []);
      const candidates = parsed.success ? parsed.data : [];
      const existingRaw = await request(database.transaction(SAVED_STORE, "readonly").objectStore(SAVED_STORE).getAll());
      const existingKeys = new Set(existingRaw.flatMap((candidate) => {
        const existing = savedIsrcSchema.safeParse(candidate);
        return existing.success ? [existing.data.key] : [];
      }));
      const transaction = database.transaction([SAVED_STORE, META_STORE], "readwrite");
      const savedStore = transaction.objectStore(SAVED_STORE);
      const pending: Array<{ name: string; artist: string }> = [];
      for (const item of candidates) {
        const validCodes = item.isrcs.flatMap((value) => {
          const normalized = normalizeIsrc(value);
          return normalized ? [normalized] : [];
        });
        if (validCodes.length === 0) pending.push({ name: item.name, artist: item.artist });
        for (const code of validCodes) {
          const key = `isrc:${code}`;
          if (existingKeys.has(key)) continue;
          const timestamp = new Date().toISOString();
          savedStore.put(savedIsrcSchema.parse({
            key,
            code,
            trackName: item.name,
            artistName: item.artist,
            albumName: null,
            artworkUrl: item.artworkUrl ?? null,
            spotifyTrackId: null,
            spotifyTrackUrl: null,
            savedAt: timestamp,
            updatedAt: timestamp,
            schemaVersion: 1,
          }));
          existingKeys.add(key);
        }
      }
      transaction.objectStore(META_STORE).put({ key: MIGRATION_KEY, completedAt: new Date().toISOString(), pending });
      await transactionDone(transaction);
      this.notify();
    } catch {
      // The provider will expose memory-only state when browser persistence is unavailable.
    }
  }

  subscribe(listener: () => void): () => void {
    if (typeof BroadcastChannel === "undefined") return () => undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", listener);
    return () => channel.close();
  }

  private notify() {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("changed");
    channel.close();
  }
}

export class SavedStorageLimitError extends Error {
  constructor() {
    super("You can save up to 1,000 codes on this device.");
    this.name = "SavedStorageLimitError";
  }
}

const legacyTracksSchema = z.array(z.object({
  name: z.string().min(1),
  artist: z.string().min(1),
  artworkUrl: z.url().optional(),
  isrcs: z.array(z.string()).default([]),
})).max(1_000);

let databasePromise: Promise<IDBDatabase> | null = null;
let repository: SavedRepository | null = null;

export function getSavedRepository(): SavedRepository {
  repository ??= new BrowserSavedRepository();
  return repository;
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains(SAVED_STORE)) database.createObjectStore(SAVED_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(HISTORY_STORE)) database.createObjectStore(HISTORY_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "key" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB could not be opened."));
    open.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
}

function request<T>(input: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    input.onsuccess = () => resolve(input.result);
    input.onerror = () => reject(input.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function sortRecords(records: SavedIsrc[]): SavedIsrc[] {
  return records.toSorted((left, right) => right.savedAt.localeCompare(left.savedAt));
}
