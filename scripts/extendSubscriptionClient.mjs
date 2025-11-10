#!/usr/bin/env node
/**
 * Script pour prolonger l'abonnement d'un utilisateur (version client Firebase)
 * Usage: node scripts/extendSubscriptionClient.mjs email@example.com [jours]
 * 
 * Ce script utilise le client Firebase (pas Admin SDK) et nécessite une connexion admin
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCHbORTw-dgJW4OWIRazYrhAemERLV68sM",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.firebasestorage.app",
  messagingSenderId: "94970966128",
  appId: "1:94970966128:web:e3af16bcd2a262e66cc4b5",
  measurementId: "G-CZC9NPN8T1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const targetEmail = process.argv[2];
const daysToAdd = parseInt(process.argv[3] || '1');

if (!targetEmail) {
  console.error('❌ ERREUR: Email requis');
  console.log('Usage: node scripts/extendSubscriptionClient.mjs email@example.com [jours]');
  console.log('\n⚠️  Ce script nécessite une connexion admin.');
  console.log('   Vous devez avoir un compte admin dans Firebase Authentication.');
  process.exit(1);
}

async function main() {
  console.log(`\n🔍 Recherche de l'utilisateur: ${targetEmail}\n`);

  // Demander les identifiants admin
  const adminEmail = process.env.ADMIN_EMAIL || process.argv[4];
  const adminPassword = process.env.ADMIN_PASSWORD || process.argv[5];

  if (!adminEmail || !adminPassword) {
    console.error('❌ ERREUR: Identifiants admin requis');
    console.log('\nOptions:');
    console.log('  1. Utiliser les variables d\'environnement:');
    console.log('     ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=password node scripts/extendSubscriptionClient.mjs email@example.com');
    console.log('  2. Passer les identifiants en arguments:');
    console.log('     node scripts/extendSubscriptionClient.mjs email@example.com 1 admin@example.com password');
    process.exit(1);
  }

  try {
    // Connexion admin
    console.log('🔐 Connexion en tant qu\'admin...');
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('✅ Connexion admin réussie\n');

    // Chercher l'utilisateur par email
    const profilesRef = collection(db, 'profiles');
    const emailQuery = query(profilesRef, where('email', '==', targetEmail));
    const snapshot = await getDocs(emailQuery);

    if (snapshot.empty) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${targetEmail}`);
      process.exit(1);
    }

    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();
    const uid = profileDoc.id;

    console.log(`✅ Utilisateur trouvé:`);
    console.log(`   - UID: ${uid}`);
    console.log(`   - Nom: ${profileData.establishmentName || profileData.ownerName || 'N/A'}`);
    console.log(`   - Email: ${profileData.email || 'N/A'}`);
    console.log(`   - Plan: ${profileData.plan || 'N/A'}`);
    console.log(`   - Type: ${profileData.subscriptionType || 'N/A'}`);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysToAddMs = daysToAdd * oneDayMs;

    // Obtenir la date de fin actuelle
    const currentEndDate = profileData.subscriptionEndsAt || now;
    const currentEndDateObj = new Date(currentEndDate);
    const daysRemaining = (currentEndDate - now) / oneDayMs;

    console.log(`\n📅 État actuel:`);
    console.log(`   - Date de fin actuelle: ${currentEndDateObj.toISOString()}`);
    console.log(`   - Jours restants: ${Math.floor(daysRemaining)}`);

    // Ajouter les jours
    const newEndDate = currentEndDate + daysToAddMs;
    const newEndDateObj = new Date(newEndDate);
    const newDaysRemaining = (newEndDate - now) / oneDayMs;

    console.log(`\n🔄 Prolongation de ${daysToAdd} jour(s)...`);

    const updateData = {
      subscriptionEndsAt: newEndDate,
      plan: 'active',
      updatedAt: now,
    };

    await updateDoc(doc(db, 'profiles', uid), updateData);

    console.log(`\n✅ ABONNEMENT PROLONGÉ:`);
    console.log(`   - Nouvelle date de fin: ${newEndDateObj.toISOString()}`);
    console.log(`   - Nouveaux jours restants: ${Math.floor(newDaysRemaining)}`);
    console.log(`   - Jours ajoutés: ${daysToAdd}`);
    console.log(`\n✨ L'utilisateur peut maintenant tester l'application !\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ ERREUR:', error?.message || error);
    if (error?.code === 'auth/invalid-credential') {
      console.error('\n⚠️  Identifiants admin incorrects. Vérifiez votre email et mot de passe.');
    }
    process.exit(1);
  }
}

main();

