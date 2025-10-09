import { collection, doc, type CollectionReference, type Firestore } from "firebase/firestore";

export const profileDocRef = (db: Firestore, uid: string) => doc(db, "profiles", uid);

export const profilesColRef = (db: Firestore): CollectionReference =>
  collection(db, "profiles") as CollectionReference;

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