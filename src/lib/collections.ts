import { collection, doc, type CollectionReference, type Firestore } from "firebase/firestore";

// --- Profils utilisateur (legacy) ---
export const profileDocRef = (db: Firestore, uid: string) => doc(db, "profiles", uid);

export const profilesColRef = (db: Firestore): CollectionReference =>
  collection(db, "profiles") as CollectionReference;

// --- Établissements (multi-établissement) ---
export const establishmentsColRef = (db: Firestore): CollectionReference =>
  collection(db, "establishments") as CollectionReference;

export const establishmentDocRef = (db: Firestore, eid: string) =>
  doc(db, "establishments", eid);

export const estProductsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "products") as CollectionReference;

export const estSalesColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "sales") as CollectionReference;

export const estLossesColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "losses") as CollectionReference;

export const estEventsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "events") as CollectionReference;

export const estEventTicketsColRef = (db: Firestore, eid: string, eventId: string): CollectionReference =>
  collection(db, "establishments", eid, "events", eventId, "tickets") as CollectionReference;

export const estTeamColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "team") as CollectionReference;

export const estOrdersColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "orders") as CollectionReference;

export const estNotificationsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "notifications") as CollectionReference;

export const estPaymentsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "payments") as CollectionReference;

export const estReceiptsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "receipts") as CollectionReference;

export const estCustomersColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "customers") as CollectionReference;

export const estLoyaltyConfigDocRef = (db: Firestore, eid: string) =>
  doc(db, "establishments", eid, "config", "loyalty");

export const estOrderCancellationsColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "orderCancellations") as CollectionReference;

export const estBarOrdersColRef = (db: Firestore, eid: string): CollectionReference =>
  collection(db, "establishments", eid, "barOrders") as CollectionReference;

// --- Legacy helpers (profil utilisateur comme racine) ---
export const productsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "products") as CollectionReference;

export const salesColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "sales") as CollectionReference;

export const lossesColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "losses") as CollectionReference;

export const eventsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "events") as CollectionReference;

export const eventTicketsColRef = (db: Firestore, uid: string, eventId: string): CollectionReference =>
  collection(db, "profiles", uid, "events", eventId, "tickets") as CollectionReference;

export const teamColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "team") as CollectionReference;

export const ordersColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "orders") as CollectionReference;

export const agentTokensTopColRef = (db: Firestore): CollectionReference =>
  collection(db, "agentTokens") as CollectionReference;

export const notificationsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "notifications") as CollectionReference;

export const adminDocRef = (db: Firestore, uid: string) => doc(db, "admins", uid);

export const paymentsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "payments") as CollectionReference;

export const receiptsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "receipts") as CollectionReference;

export const customersColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "customers") as CollectionReference;

export const loyaltyConfigDocRef = (db: Firestore, uid: string) => 
  doc(db, "profiles", uid, "config", "loyalty");

export const subscriptionPlansColRef = (db: Firestore): CollectionReference =>
  collection(db, "subscriptionPlans") as CollectionReference;

export const subscriptionPlanDocRef = (db: Firestore, planKey: string) =>
  doc(db, "subscriptionPlans", planKey);

export const orderCancellationsColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "orderCancellations") as CollectionReference;

export const barOrdersColRef = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "profiles", uid, "barOrders") as CollectionReference;

export const disbursementRequestsColRef = (db: Firestore): CollectionReference =>
  collection(db, "disbursementRequests") as CollectionReference;

export const affiliatesColRef = (db: Firestore): CollectionReference =>
  collection(db, "affiliates") as CollectionReference;

export const tabletsColRef = (db: Firestore): CollectionReference =>
  collection(db, "tablets") as CollectionReference;

export const supportTicketsColRef = (db: Firestore): CollectionReference =>
  collection(db, "supportTickets") as CollectionReference;

export const affiliateDocRef = (db: Firestore, code: string) => doc(db, "affiliates", code.toUpperCase()); 