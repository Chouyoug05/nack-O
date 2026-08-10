import {
  addDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { supportTicketsColRef, tabletsColRef } from "@/lib/collections";

export type TabletStatus = "active" | "blocked";
export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TabletDoc = {
  imei: string;
  ownerUid: string;
  establishmentName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  label?: string;
  userAgent?: string;
  platform?: string;
  registeredAt: number;
  lastSeenAt: number;
  status: TabletStatus;
};

export type SupportTicketDoc = {
  ownerUid: string;
  establishmentName?: string;
  ownerName?: string;
  email?: string;
  whatsapp?: string;
  tabletImei?: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  createdAt: number;
  updatedAt: number;
  adminReply?: string;
  adminRepliedAt?: number;
  adminUid?: string;
};

export function sanitizeImei(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

export function validateImei(value: string): boolean {
  const imei = sanitizeImei(value);
  return imei.length >= 14 && imei.length <= 15;
}

export async function listTabletsByOwner(db: Firestore, ownerUid: string) {
  const q = query(tabletsColRef(db), where("ownerUid", "==", ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TabletDoc & { id: string }));
}

export async function listAllTablets(db: Firestore) {
  const snap = await getDocs(tabletsColRef(db));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TabletDoc & { id: string }));
}

export async function registerTablet(
  db: Firestore,
  ownerUid: string,
  profile: Partial<TabletDoc>,
  imeiInput: string,
  label?: string
) {
  const imei = sanitizeImei(imeiInput);
  if (!validateImei(imei)) throw new Error("IMEI invalide (14 ou 15 chiffres requis)");
  const now = Date.now();
  const payload: TabletDoc = {
    imei,
    ownerUid,
    establishmentName: profile.establishmentName || "",
    ownerName: profile.ownerName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    whatsapp: profile.whatsapp || "",
    label: label || "Tablette principale",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    platform: typeof navigator !== "undefined" ? navigator.platform : "",
    registeredAt: now,
    lastSeenAt: now,
    status: "active",
  };
  await setDoc(doc(tabletsColRef(db), imei), payload, { merge: true });
  return payload;
}

export async function touchTabletLastSeen(db: Firestore, imeiInput: string, ownerUid: string) {
  const imei = sanitizeImei(imeiInput);
  if (!imei) return;
  await updateDoc(doc(tabletsColRef(db), imei), {
    lastSeenAt: Date.now(),
    ownerUid,
  }).catch(() => undefined);
}

export async function listSupportTicketsByOwner(db: Firestore, ownerUid: string) {
  const q = query(supportTicketsColRef(db), where("ownerUid", "==", ownerUid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SupportTicketDoc & { id: string }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function listAllSupportTickets(db: Firestore) {
  const snap = await getDocs(supportTicketsColRef(db));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SupportTicketDoc & { id: string }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function createSupportTicket(
  db: Firestore,
  ownerUid: string,
  profile: Partial<SupportTicketDoc>,
  input: { subject: string; message: string; tabletImei?: string }
) {
  const subject = String(input.subject || "").trim();
  const message = String(input.message || "").trim();
  if (!subject || !message) throw new Error("Sujet et message requis");
  const now = Date.now();
  const payload: SupportTicketDoc = {
    ownerUid,
    establishmentName: profile.establishmentName || "",
    ownerName: profile.ownerName || "",
    email: profile.email || "",
    whatsapp: profile.whatsapp || "",
    tabletImei: input.tabletImei ? sanitizeImei(input.tabletImei) : "",
    subject,
    message,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(supportTicketsColRef(db), payload);
  return { id: ref.id, ...payload };
}

export async function replySupportTicket(
  db: Firestore,
  ticketId: string,
  adminUid: string,
  reply: string,
  status: SupportTicketStatus = "in_progress"
) {
  const text = String(reply || "").trim();
  if (!text) throw new Error("Réponse requise");
  await updateDoc(doc(supportTicketsColRef(db), ticketId), {
    adminReply: text,
    adminRepliedAt: Date.now(),
    adminUid,
    status,
    updatedAt: Date.now(),
  });
}

export function tabletStorageKey(uid: string) {
  return `nack_tablet_imei_${uid}`;
}

export function rememberTabletImei(uid: string, imei: string) {
  try {
    localStorage.setItem(tabletStorageKey(uid), sanitizeImei(imei));
  } catch {
    // ignore
  }
}

export function getRememberedTabletImei(uid: string) {
  try {
    return localStorage.getItem(tabletStorageKey(uid)) || "";
  } catch {
    return "";
  }
}
