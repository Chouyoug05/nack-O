import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import type { MenuConfig, MenuTable, MenuDesignId } from "@/types/menuConfig";

// ─── Collection references ──────────────────────────────────────────────────

export const menuConfigDocRef = (db: Firestore, uid: string) =>
  doc(db, "menuConfigs", uid);

export const menuTablesColRef = (db: Firestore, uid: string) =>
  collection(db, "menuConfigs", uid, "tables");

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getMenuConfig(db: Firestore, uid: string): Promise<MenuConfig | null> {
  const snap = await getDoc(menuConfigDocRef(db, uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as MenuConfig;
}

export async function getMenuTables(db: Firestore, uid: string): Promise<MenuTable[]> {
  const q = query(menuTablesColRef(db, uid), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuTable));
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createMenuConfig(
  db: Firestore,
  uid: string,
  data: Partial<Omit<MenuConfig, "uid" | "ownerUid" | "createdAt" | "updatedAt">>,
): Promise<MenuConfig> {
  const now = Date.now();
  const payload: MenuConfig = {
    uid,
    ownerUid: uid,
    selectedDesign: data.selectedDesign ?? "modern",
    enabled: data.enabled ?? false,
    dailySpecialMode: data.dailySpecialMode ?? false,
    tables: [],
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(menuConfigDocRef(db, uid), payload);
  return payload;
}

export async function updateMenuConfig(
  db: Firestore,
  uid: string,
  data: Partial<Omit<MenuConfig, "uid" | "createdAt">>,
): Promise<void> {
  await updateDoc(menuConfigDocRef(db, uid), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function setMenuEnabled(
  db: Firestore,
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateDoc(menuConfigDocRef(db, uid), {
    enabled,
    updatedAt: Date.now(),
  });
}

export async function setMenuDesign(
  db: Firestore,
  uid: string,
  designId: MenuDesignId,
): Promise<void> {
  await updateDoc(menuConfigDocRef(db, uid), {
    selectedDesign: designId,
    updatedAt: Date.now(),
  });
}

export async function setDailySpecialMode(
  db: Firestore,
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateDoc(menuConfigDocRef(db, uid), {
    dailySpecialMode: enabled,
    updatedAt: Date.now(),
  });
}

// ─── Table management ───────────────────────────────────────────────────────

function generateQrToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function addTable(
  db: Firestore,
  uid: string,
  number: string,
  options?: { capacity?: number; zone?: string },
): Promise<MenuTable> {
  const table: Omit<MenuTable, "id"> = {
    number,
    qrToken: generateQrToken(),
    capacity: options?.capacity,
    zone: options?.zone,
    createdAt: Date.now(),
  };
  const ref = await addDoc(menuTablesColRef(db, uid), table);
  return { id: ref.id, ...table } as MenuTable;
}

export async function updateTable(
  db: Firestore,
  uid: string,
  tableId: string,
  data: Partial<Pick<MenuTable, "number" | "capacity" | "zone">>,
): Promise<void> {
  await updateDoc(doc(menuTablesColRef(db, uid), tableId), data);
}

export async function deleteTable(
  db: Firestore,
  uid: string,
  tableId: string,
): Promise<void> {
  await deleteDoc(doc(menuTablesColRef(db, uid), tableId));
}

export async function regenerateTableQrToken(
  db: Firestore,
  uid: string,
  tableId: string,
): Promise<string> {
  const newToken = generateQrToken();
  await updateDoc(doc(menuTablesColRef(db, uid), tableId), { qrToken: newToken });
  return newToken;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Génère l'URL publique du menu pour un établissement. */
export function getPublicMenuUrl(uid: string, tableQrToken?: string): string {
  const base = `https://nack.pro/light/#/menu/${uid}`;
  return tableQrToken ? `${base}?table=${tableQrToken}` : base;
}

/** Construit l'URL relative pour le light app. */
export function getPublicMenuPath(uid: string, tableQrToken?: string): string {
  const base = `#/menu/${uid}`;
  return tableQrToken ? `${base}?table=${tableQrToken}` : base;
}
