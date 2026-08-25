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
    const { profileId } = JSON.parse(event.body || "{}");
    if (!profileId) return json(400, { error: "profileId requis" });

    const productsSnap = await db.collection(`profiles/${profileId}/products`).get();
    const products = productsSnap.docs.map(d => ({ id: d.id, name: d.data().name, quantity: d.data().quantity }));

    const salesSnap = await db.collection(`profiles/${profileId}/sales`).get();
    const sales = salesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        stockRecovered: data.stockRecovered || false,
        stockDecrementedAt: data.stockDecrementedAt || null,
        items: (data.items || []).map(i => ({ id: i.id || i.productId, name: i.name, quantity: i.quantity }))
      };
    });

    const unrecovered = sales.filter(s => !s.stockRecovered && !s.stockDecrementedAt);
    const productIds = new Set(products.map(p => p.id));

    const missingProducts = {};
    for (const sale of unrecovered) {
      for (const item of sale.items) {
        if (item.id && !productIds.has(item.id)) {
          missingProducts[item.id] = item.name;
        }
      }
    }

    return json(200, {
      profileId,
      productsCount: products.length,
      salesCount: sales.length,
      salesRecovered: sales.filter(s => s.stockRecovered).length,
      salesNotRecovered: unrecovered.length,
      missingProducts: Object.entries(missingProducts).map(([id, name]) => ({ id, name })),
      sampleProducts: products.filter(p => p.quantity > 0).slice(0, 10)
    });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
