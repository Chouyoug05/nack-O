const { admin } = require("./_firebaseAdmin");
const { json, parseBody, checkInternalSecret } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Nack-Internal-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  const expectedAdmin = process.env.ADMIN_FUNCTION_SECRET;
  if (expectedAdmin && adminSecret !== expectedAdmin) return json(403, { error: "Secret requis" });

  try {
    const db = admin.firestore();
    const { profileId } = JSON.parse(event.body || "{}");

    if (!profileId) return json(400, { error: "profileId requis" });

    // 1. Lister les produits avec leur stock
    const productsSnap = await db.collection(`profiles/${profileId}/products`).get();
    const products = productsSnap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, quantity: data.quantity, stock: data.stock };
    });

    // 2. Lister les ventes et vérifier stockRecovered
    const salesSnap = await db.collection(`profiles/${profileId}/sales`).get();
    const sales = salesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        stockRecovered: data.stockRecovered || false,
        stockDecrementedAt: data.stockDecrementedAt || null,
        createdAt: data.createdAt,
        items: (data.items || []).map(i => ({ id: i.id, name: i.name, quantity: i.quantity }))
      };
    });

    // 3. Calculer le stock théorique (ventes non récupérées)
    let theoreticalDeduction = 0;
    for (const sale of sales) {
      if (!sale.stockRecovered && !sale.stockDecrementedAt) {
        for (const item of sale.items) {
          theoreticalDeduction += item.quantity;
        }
      }
    }

    return json(200, {
      profileId,
      productsCount: products.length,
      products: products.slice(0, 20),
      salesCount: sales.length,
      salesRecovered: sales.filter(s => s.stockRecovered).length,
      salesNotRecovered: sales.filter(s => !s.stockRecovered && !s.stockDecrementedAt).length,
      salesWithDecrementedAt: sales.filter(s => s.stockDecrementedAt).length,
      theoreticalDeduction
    });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
