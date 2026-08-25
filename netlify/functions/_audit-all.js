const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (process.env.ADMIN_FUNCTION_SECRET && adminSecret !== process.env.ADMIN_FUNCTION_SECRET) return json(403, { error: "Secret requis" });

  try {
    const db = admin.firestore();
    const profilesSnap = await db.collection("profiles").get();

    const report = {
      totalProfiles: profilesSnap.size,
      profilesChecked: 0,
      profilesOk: 0,
      profilesWithIssues: [],
      totalUnrecovered: 0,
      totalInvalidIds: 0,
      totalMissingProducts: 0,
      totalZeroStock: 0
    };

    for (const profileDoc of profilesSnap.docs) {
      const pid = profileDoc.id;
      const pData = profileDoc.data();
      report.profilesChecked++;

      try {
        // Produits
        const prodSnap = await db.collection(`profiles/${pid}/products`).get();
        const productIds = new Set(prodSnap.docs.map(d => d.id));
        const productsByName = new Map();
        for (const pDoc of prodSnap.docs) {
          const norm = normalize(pDoc.data().name);
          if (norm) productsByName.set(norm, { id: pDoc.id, name: pDoc.data().name, qty: pDoc.data().quantity });
        }

        // Ventes
        const salesSnap = await db.collection(`profiles/${pid}/sales`).get();
        const issues = [];

        for (const saleDoc of salesSnap.docs) {
          const saleData = saleDoc.data();
          const items = saleData.items || [];
          if (items.length === 0) continue;

          for (const item of items) {
            const qty = Number(item.quantity || item.qty || 0);
            if (qty <= 0) continue;

            let productId = item.id || item.productId;
            let found = false;
            let issue = null;

            if (productId) {
              if (productIds.has(productId)) {
                found = true;
              } else {
                issue = { type: 'invalid_id', saleId: saleDoc.id, itemName: item.name, itemId: productId };
              }
            }

            if (!found && item.name) {
              const norm = normalize(item.name);
              if (productsByName.has(norm)) {
                found = true;
              } else {
                issue = { type: 'missing_product', saleId: saleDoc.id, itemName: item.name };
              }
            }

            if (!found && issue) {
              issues.push(issue);
            }
          }
        }

        if (issues.length > 0) {
          report.profilesWithIssues.push({
            profileId: pid,
            ownerName: pData.ownerName || pData.email || 'unknown',
            issueCount: issues.length,
            invalidIds: issues.filter(i => i.type === 'invalid_id').length,
            missingProducts: issues.filter(i => i.type === 'missing_product').length,
            issues: issues.slice(0, 10)
          });
          report.totalInvalidIds += issues.filter(i => i.type === 'invalid_id').length;
          report.totalMissingProducts += issues.filter(i => i.type === 'missing_product').length;
          report.totalUnrecovered += issues.length;
        } else {
          report.profilesOk++;
        }
      } catch (e) {
        report.profilesWithIssues.push({ profileId: pid, error: e.message });
      }
    }

    return json(200, report);
  } catch (error) {
    return json(500, { error: error.message });
  }
};
