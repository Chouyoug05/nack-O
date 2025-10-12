import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Usage:
//   node scripts/backfillSubscriptions.mjs TARGET=all
// Env:
//   SERVICE_ACCOUNT_JSON or SERVICE_ACCOUNT_PATH
//   FIREBASE_PROJECT_ID (optional)

async function main() {
  const serviceAccountJsonRaw = process.env.SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID;

  if (!serviceAccountJsonRaw && !serviceAccountPath) {
    console.error('Missing SERVICE_ACCOUNT_JSON or SERVICE_ACCOUNT_PATH');
    process.exit(1);
  }

  let serviceAccount;
  if (serviceAccountJsonRaw) {
    serviceAccount = JSON.parse(serviceAccountJsonRaw);
  } else {
    const jsonPath = resolve(serviceAccountPath);
    const raw = readFileSync(jsonPath, 'utf8');
    serviceAccount = JSON.parse(raw);
  }

  const projectId = projectIdEnv || serviceAccount.project_id;
  if (!projectId) {
    console.error('Missing projectId');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount), projectId });
  const db = getFirestore();

  // Fetch all profiles
  const snap = await db.collection('profiles').get();
  console.log(`Found ${snap.size} profiles`);

  let updated = 0;
  const now = Date.now();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const uid = docSnap.id;
    const plan = data.plan;
    const subEnds = typeof data.subscriptionEndsAt === 'number' ? data.subscriptionEndsAt : 0;
    const trialEnds = typeof data.trialEndsAt === 'number' ? data.trialEndsAt : 0;

    // Normalize plan based on subscriptionEndsAt and trialEndsAt
    let nextPlan = plan;
    if (!nextPlan) {
      if (subEnds && subEnds > now) nextPlan = 'active';
      else if (trialEnds && trialEnds > now) nextPlan = 'trial';
      else nextPlan = 'expired';
    }

    // Backfill lastPaymentAt if active and missing
    let lastPaymentAt = data.lastPaymentAt;
    if (!lastPaymentAt && subEnds && subEnds > 0) {
      // infer payment date as 30 days before end if within reasonable range
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      lastPaymentAt = subEnds - thirtyDays;
      if (lastPaymentAt > now) {
        // if calculated in future, clamp to now - 1h
        lastPaymentAt = now - 60 * 60 * 1000;
      }
    }

    const payload = {};
    if (nextPlan && nextPlan !== plan) payload.plan = nextPlan;
    if (lastPaymentAt && !data.lastPaymentAt) payload.lastPaymentAt = lastPaymentAt;
    if (Object.keys(payload).length > 0) {
      payload.updatedAt = now;
      await docSnap.ref.set(payload, { merge: true });
      updated++;
      // Optionally add a notification so the user sees a billing entry
      try {
        if (payload.lastPaymentAt) {
          await db.collection('profiles').doc(uid).collection('notifications').add({
            title: 'Paiement enregistré',
            message: 'Votre abonnement (2,500 XAF) a été normalisé. Merci!',
            type: 'success',
            createdAt: now,
            read: false,
          });
        }
      } catch {}
    }
  }

  console.log(`UPDATED ${updated} profiles`);
}

main().catch((err) => {
  console.error('ERROR', err?.message || err);
  process.exit(1);
});


