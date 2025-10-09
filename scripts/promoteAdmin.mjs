import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  const serviceAccountJsonRaw = process.env.SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
  const targetUid = process.env.TARGET_UID || process.argv[2];
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID;

  if (!serviceAccountJsonRaw && !serviceAccountPath) {
    console.error('Missing SERVICE_ACCOUNT_JSON or SERVICE_ACCOUNT_PATH');
    process.exit(1);
  }
  if (!targetUid) {
    console.error('Missing TARGET_UID');
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

  const ref = db.doc(`admins/${targetUid}`);
  await ref.set({
    role: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }, { merge: true });

  console.log(`ADMIN_CREATED ${targetUid}`);
}

main().catch((err) => {
  console.error('ERROR', err?.message || err);
  process.exit(1);
}); 