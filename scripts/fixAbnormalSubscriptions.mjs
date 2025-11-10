#!/usr/bin/env node
/**
 * Script pour corriger les abonnements anormaux (> 30 jours)
 * Usage: node scripts/fixAbnormalSubscriptions.mjs [userId]
 * Si userId fourni, corrige uniquement cet utilisateur
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}';

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
const targetUserId = process.argv[2] || null;
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

async function fixAbnormalSubscription(profileDoc) {
  const data = profileDoc.data();
  const uid = profileDoc.id;
  const now = Date.now();
  
  if (data.plan !== 'active' || !data.subscriptionEndsAt) {
    return { skipped: true, reason: 'Pas d\'abonnement actif' };
  }
  
  const subscriptionEndsAt = data.subscriptionEndsAt;
  const daysRemaining = (subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
  
  // Si l'abonnement a plus de 30 jours restants, c'est anormal
  if (daysRemaining <= 30) {
    return { skipped: true, reason: `Abonnement normal (${Math.floor(daysRemaining)} jours restants)` };
  }
  
  console.log(`\nProfil: ${data.email || uid}`);
  console.log(`  Abonnement anormal détecté: ${Math.floor(daysRemaining)} jours restants`);
  console.log(`  Date de fin actuelle: ${new Date(subscriptionEndsAt).toISOString()}`);
  
  // Corriger: mettre 30 jours à partir de maintenant
  const newSubscriptionEndsAt = now + thirtyDaysMs;
  const newDaysRemaining = 30;
  
  try {
    await profileDoc.ref.update({
      subscriptionEndsAt: newSubscriptionEndsAt,
      updatedAt: now,
    });
    
    console.log(`  ✅ CORRIGÉ:`);
    console.log(`     - Nouvelle date de fin: ${new Date(newSubscriptionEndsAt).toISOString()}`);
    console.log(`     - Nouveaux jours restants: ${newDaysRemaining}`);
    
    return { fixed: true, oldDays: Math.floor(daysRemaining), newDays: newDaysRemaining };
  } catch (error) {
    console.log(`  ❌ ERREUR: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  try {
    if (targetUserId) {
      // Corriger un utilisateur spécifique
      const profileRef = db.collection('profiles').doc(targetUserId);
      const profileDoc = await profileRef.get();
      
      if (!profileDoc.exists) {
        console.error(`Profil non trouvé pour ${targetUserId}`);
        process.exit(1);
      }
      
      const result = await fixAbnormalSubscription(profileDoc);
      
      console.log('\n' + '='.repeat(50));
      if (result.fixed) {
        console.log(`✅ Abonnement corrigé: ${result.oldDays} jours → ${result.newDays} jours`);
      } else if (result.skipped) {
        console.log(`⏭️  ${result.reason}`);
      } else if (result.error) {
        console.log(`❌ Erreur: ${result.error}`);
      }
    } else {
      // Vérifier tous les utilisateurs
      console.log('Recherche de tous les abonnements anormaux (> 30 jours)...\n');
      
      const profilesSnapshot = await db.collection('profiles')
        .where('plan', '==', 'active')
        .get();
      
      console.log(`Trouvé ${profilesSnapshot.size} profil(s) actif(s) à vérifier\n`);
      
      let totalFixed = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      
      for (const profileDoc of profilesSnapshot.docs) {
        const result = await fixAbnormalSubscription(profileDoc);
        if (result.fixed) totalFixed++;
        else if (result.skipped) totalSkipped++;
        else if (result.error) totalErrors++;
      }
      
      console.log('\n' + '='.repeat(50));
      console.log(`Résumé global:`);
      console.log(`  ✅ Abonnements corrigés: ${totalFixed}`);
      console.log(`  ⏭️  Abonnements normaux: ${totalSkipped}`);
      console.log(`  ❌ Erreurs: ${totalErrors}`);
    }
    
  } catch (error) {
    console.error('ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});

