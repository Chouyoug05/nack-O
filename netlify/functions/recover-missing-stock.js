const { admin } = require("./_firebaseAdmin");
const { json, parseBody, checkInternalSecret } = require("./_security");

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Nack-Internal-Secret, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  const expectedAdmin = process.env.ADMIN_FUNCTION_SECRET;
  const expectedInternal = process.env.NACK_INTERNAL_SECRET;
  if (expectedAdmin && adminSecret !== expectedAdmin && expectedInternal && (event.headers["x-nack-internal-secret"] || event.headers["X-Nack-Internal-Secret"]) !== expectedInternal) {
    return json(403, { error: "Secret requis" });
  }

  const input = parseBody(event);
  const dryRun = input && input.dryRun === true;
  const targetProfileId = input && input.profileId;

  try {
    const db = admin.firestore();

    let profilesSnapshot;
    if (targetProfileId) {
      const doc = await db.doc(`profiles/${targetProfileId}`).get();
      profilesSnapshot = doc.exists ? { docs: [doc], size: 1 } : { docs: [], size: 0 };
    } else {
      profilesSnapshot = await db.collection("profiles").get();
    }

    const results = {
      totalProfiles: profilesSnapshot.size,
      profilesWithSales: 0,
      totalSalesRecovered: 0,
      totalStockDecremented: 0,
      errors: [],
      details: []
    };

    for (const profileDoc of profilesSnapshot.docs) {
      const profileId = profileDoc.id;
      const profileResult = { profileId, salesProcessed: 0, stockDecremented: 0, errors: [] };

      // Charger tous les produits en memoire pour la recherche par nom
      const productsSnap = await db.collection(`profiles/${profileId}/products`).get();
      const productsById = new Map();
      const productsByName = new Map();
      for (const pDoc of productsSnap.docs) {
        const pData = pDoc.data();
        productsById.set(pDoc.id, { ref: pDoc.ref, data: pData });
        const norm = normalize(pData.name);
        if (norm && !productsByName.has(norm)) {
          productsByName.set(norm, { id: pDoc.id, ref: pDoc.ref, data: pData });
        }
      }

      const salesSnapshot = await db.collection(`profiles/${profileId}/sales`).get();

      for (const saleDoc of salesSnapshot.docs) {
        const saleData = saleDoc.data();
        if (saleData.stockRecovered || saleData.stockDecrementedAt) continue;

        const items = saleData.items || [];
        if (items.length === 0) continue;

        try {
          const batch = db.batch();
          let updatedCount = 0;

          for (const item of items) {
            let productId = item.id || item.productId;
            const quantity = Number(item.quantity || item.qty || 0);
            if (quantity <= 0) continue;

            let productInfo = null;

            // 1. Chercher par ID
            if (productId) {
              productInfo = productsById.get(productId);
            }

            // 2. Si pas trouve, chercher par nom normalise
            if (!productInfo && item.name) {
              productInfo = productsByName.get(normalize(item.name));
            }

            if (!productInfo) continue;

            batch.update(productInfo.ref, {
              quantity: admin.firestore.FieldValue.increment(-quantity),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updatedCount++;
          }

          if (updatedCount > 0 && !dryRun) {
            batch.update(saleDoc.ref, {
              stockRecovered: true,
              recoveredAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
          }

          if (updatedCount > 0) {
            profileResult.salesProcessed++;
            profileResult.stockDecremented += updatedCount;
          }
        } catch (saleError) {
          profileResult.errors.push(`Sale ${saleDoc.id}: ${saleError.message}`);
        }
      }

      if (profileResult.salesProcessed > 0 || profileResult.errors.length > 0) {
        results.profilesWithSales++;
        results.totalSalesRecovered += profileResult.salesProcessed;
        results.totalStockDecremented += profileResult.stockDecremented;
        results.details.push(profileResult);
      }
      results.errors.push(...profileResult.errors);
    }

    return json(200, {
      success: true,
      mode: dryRun ? "dry-run" : "executed",
      summary: {
        profilesProcessed: results.totalProfiles,
        profilesWithSales: results.profilesWithSales,
        totalSalesRecovered: results.totalSalesRecovered,
        totalStockDecremented: results.totalStockDecremented,
        errorsCount: results.errors.length
      },
      details: results.details,
      errors: results.errors
    });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
