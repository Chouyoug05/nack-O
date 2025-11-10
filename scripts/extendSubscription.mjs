#!/usr/bin/env node
/**
 * Script pour prolonger l'abonnement d'un utilisateur
 * Usage: node scripts/extendSubscription.mjs email@example.com [jours]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const SERVICE_ACCOUNT_JSON = process.env.SERVICE_ACCOUNT_JSON || '{}';

if (!FIREBASE_PROJECT_ID) {
  console.error('❌ ERREUR: FIREBASE_PROJECT_ID requis');
  process.exit(1);
}

let app;
try {
  const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: FIREBASE_PROJECT_ID,
  });
} catch (e) {
  console.error('❌ ERREUR: Impossible de parser SERVICE_ACCOUNT_JSON:', e.message);
  process.exit(1);
}

const db = getFirestore(app);
const targetEmail = process.argv[2];
const daysToAdd = parseInt(process.argv[3] || '1');

if (!targetEmail) {
  console.error('❌ ERREUR: Email requis');
  console.log('Usage: node scripts/extendSubscription.mjs email@example.com [jours]');
  process.exit(1);
}

  console.log(`\n🔍 Recherche de l'utilisateur: ${targetEmail}\n`);

  // Chercher par email
  const profilesRef = db.collection('profiles');
  const emailQuery = profilesRef.where('email', '==', targetEmail);
  const snapshot = await emailQuery.get();

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
  let currentEndDate = profileData.subscriptionEndsAt;
  
  if (!currentEndDate) {
    // Si pas de date de fin, créer un abonnement à partir de maintenant
    currentEndDate = now;
    console.log(`\n⚠️  Pas de subscriptionEndsAt défini, création d'un abonnement à partir de maintenant`);
  }

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
    updatedAt: now,
  };

  // S'assurer que le plan est actif si l'abonnement est valide
  if (newEndDate > now && profileData.plan !== 'active') {
    updateData.plan = 'active';
    console.log(`   - Plan mis à jour: active`);
  }

  await profileDoc.ref.update(updateData);

  console.log(`\n✅ ABONNEMENT PROLONGÉ:`);
  console.log(`   - Nouvelle date de fin: ${newEndDateObj.toISOString()}`);
  console.log(`   - Nouveaux jours restants: ${Math.floor(newDaysRemaining)}`);
  console.log(`   - Jours ajoutés: ${daysToAdd}`);
  console.log(`\n✨ L'utilisateur peut maintenant tester l'application !\n`);
}

main().catch((err) => {
  console.error('❌ ERREUR:', err?.message || err);
  process.exit(1);
});

