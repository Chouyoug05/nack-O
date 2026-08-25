const { admin } = require("./_firebaseAdmin");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const ADMIN_SECRET = process.env.ADMIN_FUNCTION_SECRET;
  const providedSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  
  if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
    return json(403, { error: "Unauthorized" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const dryRun = body.dryRun !== false;
  const results = [];

  try {
    const db = admin.firestore();
    
    const profilesSnap = await db.collection("profiles").get();
    
    for (const profileDoc of profilesSnap.docs) {
      const profileId = profileDoc.id;
      const profileResult = {
        profileId,
        salesProcessed: 0,
        stockDecremented: 0,
        errors: []
      };

      try {
        const salesRef = db.collection(`profiles/${profileId}/sales`);
        const salesSnap = await salesRef.get();

        for (const saleDoc of salesSnap.docs) {
          const saleData = saleDoc.data();
          
          if (saleData.stockDecrementedAt || saleData.stockRecovered) {
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

        if (profileResult.salesProcessed > 0 || profileResult.errors.length > 0) {
          results.push(profileResult);
        }
      } catch (error) {
        profileResult.errors.push(`Error processing profile: ${error.message}`);
        results.push(profileResult);
      }
    }

    const summary = {
      mode: dryRun ? "dry-run" : "executed",
      profilesProcessed: results.length,
      totalSalesRecovered: results.reduce((sum, r) => sum + r.salesProcessed, 0),
      totalStockDecremented: results.reduce((sum, r) => sum + r.stockDecremented, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0)
    };

    return json(200, { success: true, summary, results });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
