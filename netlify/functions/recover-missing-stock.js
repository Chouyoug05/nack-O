const { admin } = require("./_firebaseAdmin");
const { json, parseBody, checkInternalSecret } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Nack-Internal-Secret, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  const internalSecret = event.headers["x-nack-internal-secret"] || event.headers["X-Nack-Internal-Secret"];
  const expectedAdmin = process.env.ADMIN_FUNCTION_SECRET;
  const expectedInternal = process.env.NACK_INTERNAL_SECRET;

  if (expectedAdmin && adminSecret !== expectedAdmin && expectedInternal && internalSecret !== expectedInternal) {
    return json(403, { error: "Secret requis" });
  }

  const input = parseBody(event);
  const dryRun = input && input.dryRun === true;

  try {
    const db = admin.firestore();

    const profilesSnapshot = await db.collection("profiles").get();
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

      try {
        const salesSnapshot = await db.collection(`profiles/${profileId}/sales`).get();

        for (const saleDoc of salesSnapshot.docs) {
          const saleData = saleDoc.data();

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
        const errorMsg = `Profile ${profileId}: ${error.message}`;
        results.errors.push(errorMsg);
        profileResult.errors.push(errorMsg);
        if (profileResult.salesProcessed > 0) {
          results.details.push(profileResult);
        }
      }
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
