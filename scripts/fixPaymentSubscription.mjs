#!/usr/bin/env node
/**
 * Script pour corriger les abonnements après paiement
 * Usage: node scripts/fixPaymentSubscription.mjs [email]
 * Si email fourni, corrige uniquement cet utilisateur
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
const targetEmail = process.argv[2] || null;

async function fixSubscription(profileDoc) {
  const data = profileDoc.data();
  const uid = profileDoc.id;
  
  // Si l'utilisateur a payé (lastPaymentAt existe) mais subscriptionEndsAt est expiré ou manquant
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  
  if (!data.lastPaymentAt) {
    return { skipped: true, reason: 'Pas de paiement enregistré' };
  }
  
  // Si subscriptionEndsAt est dans le passé ou manquant mais qu'il y a eu un paiement
  const subEndsAt = data.subscriptionEndsAt || 0;
  const needsFix = subEndsAt <= now && data.lastPaymentAt > 0;
  
  if (!needsFix) {
    // Vérifier si subscriptionEndsAt est valide
    if (subEndsAt > now) {
      return { skipped: true, reason: 'Abonnement déjà valide' };
    }
    return { skipped: true, reason: 'Pas besoin de correction' };
  }
  
  // Calculer la nouvelle date de fin
  // Si le paiement est récent (moins de 35 jours), ajouter 30 jours depuis maintenant
  // Sinon, ajouter 30 jours depuis la date de paiement
  const paymentDate = data.lastPaymentAt;
  const daysSincePayment = (now - paymentDate) / (24 * 60 * 60 * 1000);
  
  let newSubscriptionEndsAt;
  if (daysSincePayment <= 35) {
    // Paiement récent, ajouter 30 jours depuis maintenant
    newSubscriptionEndsAt = now + thirtyDaysMs;
  } else {
    // Paiement ancien, calculer depuis la date de paiement
    newSubscriptionEndsAt = paymentDate + thirtyDaysMs;
    // Si ça donne une date dans le passé, mettre maintenant + 30 jours
    if (newSubscriptionEndsAt <= now) {
      newSubscriptionEndsAt = now + thirtyDaysMs;
    }
  }
  
  // Déterminer le type d'abonnement si manquant
  let subscriptionType = data.subscriptionType || 'transition';
  
  const updateData = {
    plan: 'active',
    subscriptionType,
    subscriptionEndsAt: newSubscriptionEndsAt,
    updatedAt: now,
  };
  
  // Pour Pro Max, initialiser les événements si nécessaire
  if (subscriptionType === 'transition-pro-max') {
    if (!data.eventsCount || data.eventsCount === undefined) {
      updateData.eventsCount = 0;
      updateData.eventsResetAt = newSubscriptionEndsAt;
    }
  }
  
  try {
    await profileDoc.ref.update(updateData);
    const daysRemaining = Math.floor((newSubscriptionEndsAt - now) / (24 * 60 * 60 * 1000));
    return {
      fixed: true,
      daysRemaining,
      subscriptionType,
      subscriptionEndsAt: new Date(newSubscriptionEndsAt).toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  try {
    let query = db.collection('profiles');
    
    if (targetEmail) {
      // Chercher par email
      query = query.where('email', '==', targetEmail);
      console.log(`Recherche de l'utilisateur: ${targetEmail}`);
    } else {
      // Chercher tous les profils avec lastPaymentAt mais subscriptionEndsAt expiré ou manquant
      console.log('Recherche de tous les profils à corriger...');
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('Aucun profil trouvé');
      return;
    }
    
    console.log(`Trouvé ${snapshot.size} profil(s)\n`);
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      console.log(`\nProfil: ${data.email || docSnap.id}`);
      console.log(`  Plan actuel: ${data.plan || 'non défini'}`);
      console.log(`  Dernier paiement: ${data.lastPaymentAt ? new Date(data.lastPaymentAt).toISOString() : 'aucun'}`);
      console.log(`  Fin abonnement: ${data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt).toISOString() : 'aucun'}`);
      
      const result = await fixSubscription(docSnap);
      
      if (result.error) {
        console.log(`  ❌ ERREUR: ${result.error}`);
        errors++;
      } else if (result.fixed) {
        console.log(`  ✅ CORRIGÉ:`);
        console.log(`     - Jours restants: ${result.daysRemaining}`);
        console.log(`     - Type: ${result.subscriptionType}`);
        console.log(`     - Nouvelle fin: ${result.subscriptionEndsAt}`);
        fixed++;
      } else {
        console.log(`  ⏭️  IGNORÉ: ${result.reason}`);
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Résumé:`);
    console.log(`  ✅ Corrigés: ${fixed}`);
    console.log(`  ⏭️  Ignorés: ${skipped}`);
    console.log(`  ❌ Erreurs: ${errors}`);
    
  } catch (error) {
    console.error('ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
