import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvM9XkKZQYQYQYQYQYQYQYQYQYQYQYQY",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function enablePayments() {
  const establishmentId = "ULOsgIQsinZT7XuRelYnRLW6OqT2";
  const profileRef = doc(db, "profiles", establishmentId);
  
  await updateDoc(profileRef, {
    paymentsEnabled: true,
    disbursementStatus: "approved",
    updatedAt: Date.now()
  });
  
  console.log("Paiements activés pour l'établissement");
}

enablePayments().catch(console.error);
