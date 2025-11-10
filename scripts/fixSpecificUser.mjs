#!/usr/bin/env node
/**
 * Script pour corriger un utilisateur spécifique
 * Usage: node scripts/fixSpecificUser.mjs email@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const SERVICE_ACCOUNT_JSON = process.env.SERVICE_ACCOUNT_JSON || '{}';

if (!FIREBASE_PROJECT_ID) {
  console.error('ERREUR: FIREBASE_PROJECT_ID requis');
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
  console.error('ERREUR: Impossible de parser SERVICE_ACCOUNT_JSON:', e.message);
  process.exit(1);
}

const db = getFirestore(app);
const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error('ERREUR: Email requis');
  console.log('Usage: node scripts/fixSpecificUser.mjs email@example.com');
  process.exit(1);
}

const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

async function main() {
  try {
    console.log(`Recherche de l'utilisateur: ${targetEmail}\n`);
    
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
    console.log(`   - Nom: ${profileData.ownerName || profileData.establishmentName || 'N/A'}`);
    console.log(`   - Plan: ${profileData.plan || 'N/A'}`);
    console.log(`   - Type: ${profileData.subscriptionType || 'N/A'}`);
    
    if (!profileData.subscriptionEndsAt) {
      console.log(`\n⚠️  Pas de subscriptionEndsAt défini`);
      process.exit(0);
    }
    
    const now = Date.now();
    const subscriptionEndsAt = profileData.subscriptionEndsAt;
    const daysRemaining = (subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
    
    console.log(`   - Date de fin actuelle: ${new Date(subscriptionEndsAt).toISOString()}`);
    console.log(`   - Jours restants: ${Math.floor(daysRemaining)}`);
    
    if (daysRemaining <= 30) {
      console.log(`\n✅ Abonnement normal (≤ 30 jours), aucune correction nécessaire`);
      process.exit(0);
    }
    
    console.log(`\n⚠️  Abonnement anormal détecté (${Math.floor(daysRemaining)} jours)`);
    console.log(`   Correction en cours...`);
    
    // Corriger à 30 jours à partir de maintenant
    const newSubscriptionEndsAt = now + thirtyDaysMs;
    
    await profileDoc.ref.update({
      subscriptionEndsAt: newSubscriptionEndsAt,
      updatedAt: now,
    });
    
    console.log(`\n✅ CORRIGÉ:`);
    console.log(`   - Ancienne date de fin: ${new Date(subscriptionEndsAt).toISOString()}`);
    console.log(`   - Nouvelle date de fin: ${new Date(newSubscriptionEndsAt).toISOString()}`);
    console.log(`   - Anciens jours restants: ${Math.floor(daysRemaining)}`);
    console.log(`   - Nouveaux jours restants: 30`);
    
  } catch (error) {
    console.error('ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});

