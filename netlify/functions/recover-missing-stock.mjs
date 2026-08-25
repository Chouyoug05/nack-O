import admin from 'firebase-admin';

const db = admin.apps[0]?.firestore() ?? admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
}).firestore();

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Vérifier le secret admin
  const adminSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (adminSecret !== process.env.ADMIN_FUNCTION_SECRET) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { dryRun = true } = JSON.parse(event.body || '{}');
    
    const results = {
      totalProfiles: 0,
      profilesWithSales: 0,
      totalSalesRecovered: 0,
      totalStockDecremented: 0,
      errors: [],
      details: []
    };

    // Récupérer tous les profils
    const profilesSnapshot = await db.collection('profiles').get();
    results.totalProfiles = profilesSnapshot.size;

    for (const profileDoc of profilesSnapshot.docs) {
      const profileId = profileDoc.id;
      const profileResult = {
        profileId,
        salesProcessed: 0,
        stockDecremented: 0,
        errors: []
      };

      try {
        // Récupérer toutes les ventes du profil
        const salesSnapshot = await db.collection(`profiles/${profileId}/sales`).get();

        for (const saleDoc of salesSnapshot.docs) {
          const saleData = saleDoc.data();

          // Ignorer les ventes déjà traitées
          if (saleData.stockRecovered || saleData.stockDecrementedAt) {
            continue;
          }

          const items = saleData.items || [];
          if (items.length === 0) continue;

          const batch = db.batch();
          let updatedCount = 0;

          for (const item of items) {
            const productId = item.id || item.productId;
            if (!productId) continue;

            const quantity = Number(item.quantity || 0);
            if (quantity <= 0) continue;

            const productRef = db.doc(`profiles/${profileId}/products/${productId}`);
            batch.update(productRef, {
              quantity: admin.firestore.FieldValue.increment(-quantity),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updatedCount++;
          }

          if (updatedCount > 0) {
            // Marquer la vente comme traitée
            batch.update(saleDoc.ref, {
              stockRecovered: true,
              recoveredAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (!dryRun) {
              await batch.commit();
            }

            profileResult.salesProcessed++;
            profileResult.stockDecremented += updatedCount;
          }
        }

        if (profileResult.salesProcessed > 0) {
          results.profilesWithSales++;
          results.totalSalesRecovered += profileResult.salesProcessed;
          results.totalStockDecremented += profileResult.stockDecremented;
          results.details.push(profileResult);
        }
      } catch (error) {
        const errorMsg = `Error processing profile ${profileId}: ${error.message}`;
        results.errors.push(errorMsg);
        profileResult.errors.push(errorMsg);
        if (profileResult.salesProcessed > 0 || profileResult.errors.length > 0) {
          results.details.push(profileResult);
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        mode: dryRun ? 'dry-run' : 'executed',
        summary: {
          profilesProcessed: results.totalProfiles,
          profilesWithSales: results.profilesWithSales,
          totalSalesRecovered: results.totalSalesRecovered,
          totalStockDecremented: results.totalStockDecremented,
          errorsCount: results.errors.length
        },
        details: results.details,
        errors: results.errors
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
