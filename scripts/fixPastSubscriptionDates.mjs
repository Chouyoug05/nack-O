#!/usr/bin/env node
/**
 * Script pour corriger les dates d'abonnement dans le passé (2024)
 * Usage: node scripts/fixPastSubscriptionDates.mjs [email]
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
const targetEmail = process.argv[2] || null;

async function fixPastSubscription(profileDoc) {
  const data = profileDoc.data();
  const uid = profileDoc.id;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  
  // Vérifier si subscriptionEndsAt existe et est dans le passé (avant 2025)
  const subscriptionEndsAt = data.subscriptionEndsAt;
  if (!subscriptionEndsAt) {
    return { skipped: true, reason: 'Pas de subscriptionEndsAt' };
  }
  
  // Vérifier si la date est en 2024 ou avant (timestamp < 2025-01-01)
  const year2025Start = new Date('2025-01-01').getTime();
  
  if (subscriptionEndsAt >= year2025Start) {
    return { skipped: true, reason: `Date déjà en 2025 ou après (${new Date(subscriptionEndsAt).toISOString()})` };
  }
  
  // Si la date est dans le passé (avant maintenant), corriger
  if (subscriptionEndsAt < now) {
    console.log(`\n📅 Profil: ${data.email || uid}`);
    console.log(`   Date actuelle: ${new Date(subscriptionEndsAt).toISOString()} (2024 ou passé)`);
    console.log(`   Date est expirée: ${subscriptionEndsAt < now ? 'Oui' : 'Non'}`);
    
    // Corriger: mettre 30 jours à partir de maintenant
    const newSubscriptionEndsAt = now + thirtyDaysMs;
    const newDate = new Date(newSubscriptionEndsAt);
    
    try {
      await profileDoc.ref.update({
        subscriptionEndsAt: newSubscriptionEndsAt,
        plan: 'active',
        updatedAt: now,
      });
      
      console.log(`   ✅ CORRIGÉ:`);
      console.log(`      - Nouvelle date: ${newDate.toISOString()}`);
      console.log(`      - Jours restants: 30`);
      
      return { fixed: true, oldDate: subscriptionEndsAt, newDate: newSubscriptionEndsAt };
    } catch (error) {
      console.log(`   ❌ ERREUR: ${error.message}`);
      return { error: error.message };
    }
  }
  
  // Si la date est en 2024 mais dans le futur (par rapport à maintenant)
  // Cela ne devrait pas arriver si on est en 2025, mais on corrige quand même
  if (subscriptionEndsAt < year2025Start && subscriptionEndsAt > now) {
    console.log(`\n📅 Profil: ${data.email || uid}`);
    console.log(`   Date actuelle: ${new Date(subscriptionEndsAt).toISOString()} (2024 mais dans le futur)`);
    
    // Corriger: mettre 30 jours à partir de maintenant
    const newSubscriptionEndsAt = now + thirtyDaysMs;
    const newDate = new Date(newSubscriptionEndsAt);
    
    try {
      await profileDoc.ref.update({
        subscriptionEndsAt: newSubscriptionEndsAt,
        updatedAt: now,
      });
      
      console.log(`   ✅ CORRIGÉ:`);
      console.log(`      - Nouvelle date: ${newDate.toISOString()}`);
      console.log(`      - Jours restants: 30`);
      
      return { fixed: true, oldDate: subscriptionEndsAt, newDate: newSubscriptionEndsAt };
    } catch (error) {
      console.log(`   ❌ ERREUR: ${error.message}`);
      return { error: error.message };
    }
  }
  
  return { skipped: true, reason: 'Date valide' };
}

async function main() {
  try {
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    if (targetEmail) {
      // Corriger un utilisateur spécifique
      console.log(`\n🔍 Recherche de l'utilisateur: ${targetEmail}\n`);
      
      const profilesRef = db.collection('profiles');
      const emailQuery = profilesRef.where('email', '==', targetEmail);
      const snapshot = await emailQuery.get();
      
      if (snapshot.empty) {
        console.error(`❌ Aucun utilisateur trouvé avec l'email: ${targetEmail}`);
        process.exit(1);
      }
      
      const profileDoc = snapshot.docs[0];
      const result = await fixPastSubscription(profileDoc);
      
      if (result.fixed) {
        fixed++;
        console.log(`\n✅ Correction effectuée pour ${targetEmail}`);
      } else if (result.error) {
        errors++;
        console.log(`\n❌ Erreur pour ${targetEmail}: ${result.error}`);
      } else {
        skipped++;
        console.log(`\n⏭️  ${targetEmail}: ${result.reason}`);
      }
    } else {
      // Corriger tous les profils
      console.log(`\n🔍 Recherche de tous les profils avec dates en 2024...\n`);
      
      const profilesRef = db.collection('profiles');
      const snapshot = await profilesRef.get();
      
      for (const profileDoc of snapshot.docs) {
        const result = await fixPastSubscription(profileDoc);
        
        if (result.fixed) {
          fixed++;
        } else if (result.error) {
          errors++;
        } else {
          skipped++;
        }
      }
    }
    
    console.log(`\n📊 RÉSUMÉ:`);
    console.log(`   ✅ Corrigés: ${fixed}`);
    console.log(`   ⏭️  Ignorés: ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`\n✨ Correction terminée !\n`);
  } catch (error) {
    console.error('❌ ERREUR:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ ERREUR:', err?.message || err);
  process.exit(1);
});

