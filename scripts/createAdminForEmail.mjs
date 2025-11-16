import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuration Firebase - utilisez vos propres clés depuis .env ou firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBvQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "nack-8c299.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "nack-8c299",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "nack-8c299.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdefghijklmnop"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createAdminForEmail(email, password) {
  try {
    console.log(`🔐 Connexion avec ${email}...`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    console.log(`✅ Connecté ! UID: ${uid}`);
    console.log(`📝 Création du document admin...`);
    
    const adminRef = doc(db, 'admins', uid);
    await setDoc(adminRef, {
      role: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    console.log(`✅ Document admin créé avec succès !`);
    console.log(`📋 UID: ${uid}`);
    console.log(`📧 Email: ${email}`);
    console.log(`\n🎉 Vous pouvez maintenant vous connecter sur /admin-check`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error('💡 L\'utilisateur n\'existe pas. Créez d\'abord le compte sur l\'application.');
    } else if (error.code === 'auth/wrong-password') {
      console.error('💡 Mot de passe incorrect.');
    } else if (error.code === 'permission-denied') {
      console.error('💡 Permission refusée. Vérifiez les règles Firestore.');
    }
    process.exit(1);
  }
}

// Récupérer email et mot de passe depuis les arguments ou variables d'environnement
const email = process.env.ADMIN_EMAIL || process.argv[2];
const password = process.env.ADMIN_PASSWORD || process.argv[3];

if (!email || !password) {
  console.error('❌ Usage: node scripts/createAdminForEmail.mjs <email> <password>');
  console.error('   OU définissez ADMIN_EMAIL et ADMIN_PASSWORD dans les variables d\'environnement');
  process.exit(1);
}

createAdminForEmail(email, password);

