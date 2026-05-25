import { addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { barOrdersColRef, notificationsColRef, ordersColRef } from "@/lib/collections";

const DB_NAME = "nack-local-sync-db";
const DB_VERSION = 1;
const STORE_NAME = "pending_orders";

type QueueChannel = "orders" | "barOrders";

type PlainObject = Record<string, unknown>;

export interface PendingOrderRecord {
  id: string;
  ownerUid: string;
  channel: QueueChannel;
  payload: PlainObject;
  notificationPayload?: PlainObject;
  createdAt: number;
}

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("ownerUid", "ownerUid", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Impossible d'ouvrir IndexedDB"));
  });
}

function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transaction IndexedDB en erreur"));
    tx.onabort = () => reject(tx.error ?? new Error("Transaction IndexedDB interrompue"));
  });
}

function buildId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueuePendingOrder(input: Omit<PendingOrderRecord, "id" | "createdAt">): Promise<void> {
  const database = await openDb();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      ...input,
      id: buildId(),
      createdAt: Date.now(),
    } as PendingOrderRecord);
    await txPromise(tx);
  } finally {
    database.close();
  }
}

export async function listPendingOrders(ownerUid?: string): Promise<PendingOrderRecord[]> {
  const database = await openDb();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const rows = await new Promise<PendingOrderRecord[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result ?? []) as PendingOrderRecord[]);
      req.onerror = () => reject(req.error ?? new Error("Lecture IndexedDB impossible"));
    });
    await txPromise(tx);
    const filtered = ownerUid ? rows.filter((row) => row.ownerUid === ownerUid) : rows;
    return filtered.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    database.close();
  }
}

export async function removePendingOrder(id: string): Promise<void> {
  const database = await openDb();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await txPromise(tx);
  } finally {
    database.close();
  }
}

async function syncOne(record: PendingOrderRecord): Promise<void> {
  if (record.channel === "orders") {
    await addDoc(ordersColRef(db, record.ownerUid), record.payload);
  } else {
    await addDoc(barOrdersColRef(db, record.ownerUid), record.payload);
  }

  if (record.notificationPayload) {
    try {
      await addDoc(notificationsColRef(db, record.ownerUid), record.notificationPayload);
    } catch {
      // La commande reste synchronisée même si la notification échoue.
    }
  }
}

export async function flushPendingOrders(ownerUid?: string): Promise<{ flushed: number; failed: number }> {
  if (!isBrowser || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { flushed: 0, failed: 0 };
  }

  const queue = await listPendingOrders(ownerUid);
  if (!queue.length) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const row of queue) {
    try {
      await syncOne(row);
      await removePendingOrder(row.id);
      flushed += 1;
    } catch {
      failed += 1;
    }
  }

  return { flushed, failed };
}
