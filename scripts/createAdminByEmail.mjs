import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

async function main() {
  const serviceAccountJsonRaw = process.env.SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
  const targetEmail = process.env.TARGET_EMAIL || process.argv[2];
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID;

  if (!serviceAccountJsonRaw && !serviceAccountPath) {
    console.error('❌ Missing SERVICE_ACCOUNT_JSON or SERVICE_ACCOUNT_PATH');
    console.error('💡 Définissez SERVICE_ACCOUNT_JSON ou SERVICE_ACCOUNT_PATH dans les variables d\'environnement');
    process.exit(1);
  }
  if (!targetEmail) {
    console.error('❌ Missing TARGET_EMAIL');
    console.error('💡 Usage: node scripts/createAdminByEmail.mjs <email>');
    console.error('   OU définissez TARGET_EMAIL dans les variables d\'environnement');
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
    console.error('❌ Missing projectId');
    process.exit(1);
  }

  try {
    initializeApp({ credential: cert(serviceAccount), projectId });
    const db = getFirestore();
    const auth = getAuth();

    console.log(`🔍 Recherche de l'utilisateur avec l'email: ${targetEmail}...`);
    
    // Chercher l'utilisateur par email
    let user;
    try {
      user = await auth.getUserByEmail(targetEmail);
      console.log(`✅ Utilisateur trouvé ! UID: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Aucun utilisateur trouvé avec l'email: ${targetEmail}`);
        console.error('💡 Créez d\'abord le compte utilisateur sur l\'application');
        process.exit(1);
      }
      throw error;
    }

    const uid = user.uid;
    console.log(`📝 Création du document admin pour UID: ${uid}...`);

    const ref = db.doc(`admins/${uid}`);
    await ref.set({
      role: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, { merge: true });

    console.log(`✅ Document admin créé avec succès !`);
    console.log(`📋 Email: ${targetEmail}`);
    console.log(`📋 UID: ${uid}`);
    console.log(`\n🎉 L'utilisateur peut maintenant se connecter sur /admin-check`);
  } catch (err) {
    console.error('❌ ERROR:', err?.message || err);
    process.exit(1);
  }
}

main();

