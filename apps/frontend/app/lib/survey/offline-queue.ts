// ── Offline response outbox (mobile-app phase 2) ───────────────────
//
// When a respondent submits a survey without a connection, the response is
// stored in IndexedDB and flushed by `offline-sync` once back online. This
// complements the local draft autosave in `draft-storage.ts` (which keeps
// in-progress answers) — the outbox holds *completed* submissions.

import type { SubmitResponseRequest } from "@/app/types/survey";

const DB_NAME = "survey-offline";
const STORE = "submissions";
const DB_VERSION = 1;

export interface QueuedSubmission {
  /** Client-generated id (also used to de-duplicate flushes). */
  id: string;
  surveyId: string;
  payload: SubmitResponseRequest;
  createdAt: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Add a completed submission to the outbox. No-op (resolves) without IDB. */
export async function enqueueSubmission(
  surveyId: string,
  payload: SubmitResponseRequest,
): Promise<QueuedSubmission | null> {
  if (!hasIndexedDb()) return null;
  const entry: QueuedSubmission = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    surveyId,
    payload,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.add(entry));
  return entry;
}

/** All queued submissions, oldest first. */
export async function listQueued(): Promise<QueuedSubmission[]> {
  if (!hasIndexedDb()) return [];
  const all = await tx<QueuedSubmission[]>("readonly", (s) =>
    s.getAll() as IDBRequest<QueuedSubmission[]>,
  );
  return all.toSorted((a, b) => a.createdAt - b.createdAt);
}

/** Remove a flushed (or abandoned) submission. */
export async function removeQueued(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await tx("readwrite", (s) => s.delete(id));
}

/** Number of pending submissions. */
export async function queuedCount(): Promise<number> {
  if (!hasIndexedDb()) return 0;
  return tx<number>("readonly", (s) => s.count());
}
