#!/usr/bin/env node
/**
 * Script pour vérifier et corriger les transactions en attente
 * qui ont été payées mais non traitées
 * Usage: node scripts/checkPendingPayments.mjs [userId]
 * Si userId fourni, vérifie uniquement cet utilisateur
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

async function checkPendingPayments(userId) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  console.log(`\nVérification des transactions en attente pour l'utilisateur: ${userId}`);
  
  // Récupérer le profil
  const profileRef = db.collection('profiles').doc(userId);
  const profileDoc = await profileRef.get();
  
  if (!profileDoc.exists) {
    console.log(`  ❌ Profil non trouvé pour ${userId}`);
    return { skipped: true, reason: 'Profil non trouvé' };
  }
  
  const profileData = profileDoc.data();
  
  // Récupérer toutes les transactions en attente
  const paymentsRef = db.collection('profiles').doc(userId).collection('payments');
  const pendingQuery = paymentsRef.where('status', '==', 'pending');
  const pendingSnapshot = await pendingQuery.get();
  
  if (pendingSnapshot.empty) {
    console.log(`  ✅ Aucune transaction en attente`);
    return { skipped: true, reason: 'Aucune transaction en attente' };
  }
  
  console.log(`  Trouvé ${pendingSnapshot.size} transaction(s) en attente\n`);
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const paymentDoc of pendingSnapshot.docs) {
    const paymentData = paymentDoc.data();
    const createdAt = paymentData.createdAt || 0;
    const daysSinceCreation = (now - createdAt) / (24 * 60 * 60 * 1000);
    
    console.log(`  Transaction: ${paymentData.transactionId}`);
    console.log(`    - Référence: ${paymentData.reference || 'N/A'}`);
    console.log(`    - Montant: ${paymentData.amount?.toLocaleString() || 'N/A'} XAF`);
    console.log(`    - Type: ${paymentData.subscriptionType || 'N/A'}`);
    console.log(`    - Créée il y a: ${Math.floor(daysSinceCreation)} jour(s)`);
    
    // Si la transaction a plus de 1 jour, elle pourrait avoir été payée
    // Vérifier si le profil a un lastPaymentAt récent qui correspond
    const lastPaymentAt = profileData.lastPaymentAt || 0;
    const paymentTimeDiff = Math.abs(lastPaymentAt - createdAt);
    const paymentWithin24h = paymentTimeDiff < (24 * 60 * 60 * 1000);
    
    // Si le profil a un abonnement actif et un paiement récent qui correspond à cette transaction
    const shouldComplete = 
      (daysSinceCreation >= 1 && paymentWithin24h && profileData.plan === 'active') ||
      (daysSinceCreation >= 7); // Transactions très anciennes (7+ jours) probablement payées
    
    if (!shouldComplete) {
      console.log(`    ⏭️  IGNORÉ: Transaction récente ou pas de correspondance avec paiement`);
      skipped++;
      continue;
    }
    
    // Calculer la nouvelle date de fin d'abonnement
    let newSubscriptionEndsAt;
    if (profileData.subscriptionEndsAt && profileData.subscriptionEndsAt > now) {
      newSubscriptionEndsAt = profileData.subscriptionEndsAt + thirtyDaysMs;
    } else {
      newSubscriptionEndsAt = now + thirtyDaysMs;
    }
    
    try {
      // Mettre à jour la transaction
      await paymentDoc.ref.update({
        status: 'completed',
        paidAt: lastPaymentAt || now,
        subscriptionEndsAt: newSubscriptionEndsAt,
        updatedAt: now,
      });
      
      // Vérifier si un reçu existe
      const receiptsRef = db.collection('profiles').doc(userId).collection('receipts');
      const receiptQuery = receiptsRef.where('transactionId', '==', paymentData.transactionId);
      const receiptSnapshot = await receiptQuery.get();
      
      if (receiptSnapshot.empty) {
        // Créer une référence de reçu
        await receiptsRef.add({
          transactionId: paymentData.transactionId,
          userId: userId,
          subscriptionType: paymentData.subscriptionType,
          amount: paymentData.amount,
          reference: paymentData.reference,
          paymentMethod: paymentData.paymentMethod || 'airtel-money',
          paidAt: lastPaymentAt || now,
          createdAt: now,
          receiptType: 'subscription',
          establishmentName: profileData.establishmentName,
        });
        console.log(`    ✅ Reçu créé`);
      }
      
      console.log(`    ✅ TRANSACTION COMPLÉTÉE`);
      console.log(`       - Nouvelle fin d'abonnement: ${new Date(newSubscriptionEndsAt).toISOString()}`);
      fixed++;
    } catch (error) {
      console.log(`    ❌ ERREUR: ${error.message}`);
      errors++;
    }
  }
  
  return { fixed, skipped, errors };
}

async function main() {
  try {
    if (targetUserId) {
      // Vérifier un utilisateur spécifique
      const result = await checkPendingPayments(targetUserId);
      console.log('\n' + '='.repeat(50));
      console.log(`Résumé pour ${targetUserId}:`);
      console.log(`  ✅ Corrigées: ${result.fixed || 0}`);
      console.log(`  ⏭️  Ignorées: ${result.skipped || 0}`);
      console.log(`  ❌ Erreurs: ${result.errors || 0}`);
    } else {
      // Vérifier tous les utilisateurs
      console.log('Recherche de tous les utilisateurs avec des transactions en attente...\n');
      
      const profilesSnapshot = await db.collection('profiles').get();
      console.log(`Trouvé ${profilesSnapshot.size} profil(s) à vérifier\n`);
      
      let totalFixed = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      
      for (const profileDoc of profilesSnapshot.docs) {
        const userId = profileDoc.id;
        const result = await checkPendingPayments(userId);
        totalFixed += result.fixed || 0;
        totalSkipped += result.skipped || 0;
        totalErrors += result.errors || 0;
      }
      
      console.log('\n' + '='.repeat(50));
      console.log(`Résumé global:`);
      console.log(`  ✅ Transactions corrigées: ${totalFixed}`);
      console.log(`  ⏭️  Transactions ignorées: ${totalSkipped}`);
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

