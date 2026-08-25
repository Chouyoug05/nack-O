const { admin } = require("./_firebaseAdmin");
const { json } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (process.env.ADMIN_FUNCTION_SECRET && adminSecret !== process.env.ADMIN_FUNCTION_SECRET) return json(403, { error: "Secret requis" });

  try {
    const db = admin.firestore();
    const { email } = JSON.parse(event.body || "{}");
    if (!email) return json(400, { error: "email requis" });

    // Chercher le profil par email
    const profilesSnap = await db.collection("profiles").where("ownerEmail", "==", email).get();
    if (profilesSnap.empty) {
      const profilesSnap2 = await db.collection("profiles").where("email", "==", email).get();
      if (profilesSnap2.empty) return json(200, { found: false, error: "Profil non trouve pour " + email });
      return processProfiles(db, profilesSnap2.docs, email);
    }
    return processProfiles(db, profilesSnap.docs, email);
  } catch (error) {
    return json(500, { error: error.message });
  }
};

async function processProfiles(db, docs, email) {
  const results = [];
  for (const profileDoc of docs) {
    const pid = profileDoc.id;
    const pData = profileDoc.data();

    // Produits
    const prodSnap = await db.collection(`profiles/${pid}/products`).get();
    const products = prodSnap.docs.map(d => {
      const p = d.data();
      return { id: d.id, name: p.name, quantity: p.quantity };
    });

    // Ventes
    const salesSnap = await db.collection(`profiles/${pid}/sales`).get();
    const sales = salesSnap.docs.map(d => {
      const s = d.data();
      const items = (s.items || []).map(i => ({
        id: i.id || i.productId || null,
        name: i.name,
        qty: i.quantity || i.qty || 0
      }));
      return {
        id: d.id,
        stockRecovered: !!s.stockRecovered,
        stockDecrementedAt: s.stockDecrementedAt || null,
        itemsCount: items.length,
        items
      };
    });

    const unrecovered = sales.filter(s => !s.stockRecovered && !s.stockDecrementedAt);

    // Normalisation pour verification
    const normalizedNameMap = new Map();
    for (const p of products) {
      const norm = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
      if (norm) normalizedNameMap.set(norm, p);
    }

    // Verifier les correspondances
    const matchResults = [];
    for (const sale of unrecovered) {
      for (const item of sale.items) {
        const saleNameNorm = (item.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
        const matched = item.id ? products.find(p => p.id === item.id) : normalizedNameMap.get(saleNameNorm);
        matchResults.push({
          saleId: sale.id,
          itemName: item.name,
          itemId: item.id,
          matched: !!matched,
          matchedProductName: matched ? matched.name : null,
          matchedProductId: matched ? matched.id : null
        });
      }
    }

    results.push({
      profileId: pid,
      ownerName: pData.ownerName,
      productsCount: products.length,
      salesCount: sales.length,
      unrecoveredCount: unrecovered.length,
      matchResults: matchResults.slice(0, 30),
      unmatchedCount: matchResults.filter(m => !m.matched).length
    });
  }

  return json(200, { found: true, profiles: results });
}
