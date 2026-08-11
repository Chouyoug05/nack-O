import {
  addDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { notificationsColRef, tabletMessagesColRef } from "@/lib/collections";
import { sanitizeImei, type TabletDoc } from "@/lib/tabletsSupport";
import type { TabletMessageDoc, TabletMessageType } from "@/types/tabletMessage";
import type { ThermalTicketData } from "@/utils/ticketThermal";

export type SendTabletMessageInput = {
  type: TabletMessageType;
  title: string;
  body: string;
  receiptData?: Partial<ThermalTicketData>;
};

export async function listTabletMessagesForImei(db: Firestore, imeiInput: string) {
  const imei = sanitizeImei(imeiInput);
  if (!imei) return [] as Array<TabletMessageDoc & { id: string }>;
  const q = query(tabletMessagesColRef(db, imei), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TabletMessageDoc) }));
}

export async function sendTabletMessageFromAdmin(
  db: Firestore,
  adminUid: string,
  tablet: TabletDoc & { id: string },
  input: SendTabletMessageInput
) {
  const imei = sanitizeImei(tablet.imei || tablet.id);
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!imei) throw new Error("IMEI tablette requis");
  if (!title) throw new Error("Titre requis");

  const payload: TabletMessageDoc = {
    tabletImei: imei,
    ownerUid: tablet.ownerUid,
    establishmentName: tablet.establishmentName || "",
    type: input.type,
    title,
    body: body || title,
    receiptData: input.receiptData,
    readAt: null,
    createdAt: Date.now(),
    sentByAdminUid: adminUid,
  };

  const ref = await addDoc(tabletMessagesColRef(db, imei), payload);

  await addDoc(notificationsColRef(db, tablet.ownerUid), {
    title: `[Tablette ${imei.slice(-4)}] ${title}`,
    message: body || title,
    type: input.type === "notification" ? "warning" : "info",
    createdAt: Date.now(),
    read: false,
    tabletImei: imei,
    tabletMessageId: ref.id,
    channel: "tablet",
  }).catch(() => undefined);

  return { id: ref.id, ...payload };
}

export async function markTabletMessageRead(
  db: Firestore,
  imeiInput: string,
  messageId: string
) {
  const imei = sanitizeImei(imeiInput);
  await updateDoc(doc(tabletMessagesColRef(db, imei), messageId), {
    readAt: Date.now(),
  });
}
