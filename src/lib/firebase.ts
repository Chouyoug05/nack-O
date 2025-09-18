import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCHbORTw-dgJW4OWIRazYrhAemERLV68sM",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.firebasestorage.app",
  messagingSenderId: "94970966128",
  appId: "1:94970966128:web:e3af16bcd2a262e66cc4b5",
  measurementId: "G-CZC9NPN8T1",
};

export const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

let analyticsInstance: Analytics | undefined;

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(app);
      }
    })
    .catch(() => {
      // ignore analytics init errors in unsupported environments
    });
}

export { analyticsInstance as analytics };

export const auth: Auth = getAuth(app);

if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // ignore persistence failures (e.g., in private mode)
  });
}

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app); 