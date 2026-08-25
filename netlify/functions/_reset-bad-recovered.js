const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (process.env.ADMIN_FUNCTION_SECRET && adminSecret !== process.env.ADMIN_FUNCTION_SECRET) return json(403, { error: "Secret requis" });

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

    let resetCount = 0;
    for (const profileDoc of profilesSnapshot.docs) {
      const pid = profileDoc.id;

      // Charger les produits pour verifier si l'ID est un nom (pas un vrai ID Firestore)
      const productsSnap = await db.collection(`profiles/${pid}/products`).get();
      const productIds = new Set(productsSnap.docs.map(d => d.id));

      const salesSnap = await db.collection(`profiles/${pid}/sales`).get();
      for (const saleDoc of salesSnap.docs) {
        const saleData = saleDoc.data();
        if (!saleData.stockRecovered) continue;

        const items = saleData.items || [];
        const hasInvalidId = items.some(item => {
          const pid2 = item.id || item.productId;
          return pid2 && !productIds.has(pid2);
        });

        if (hasInvalidId) {
          if (!dryRun) {
            await saleDoc.ref.update({ stockRecovered: false });
          }
          resetCount++;
        }
      }
    }

    return json(200, { mode: dryRun ? "dry-run" : "executed", resetCount });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
