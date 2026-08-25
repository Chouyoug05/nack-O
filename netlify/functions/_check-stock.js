const { admin } = require("./_firebaseAdmin");
const { json } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const adminSecret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (process.env.ADMIN_FUNCTION_SECRET && adminSecret !== process.env.ADMIN_FUNCTION_SECRET) return json(403, { error: "Secret requis" });

  try {
    const db = admin.firestore();
    const { profileId } = JSON.parse(event.body || "{}");
    if (!profileId) return json(400, { error: "profileId requis" });

    const prodSnap = await db.collection(`profiles/${profileId}/products`).get();
    const products = prodSnap.docs.map(d => ({ id: d.id, name: d.data().name, quantity: d.data().quantity }));

    const salesSnap = await db.collection(`profiles/${profileId}/sales`).get();
    const sales = salesSnap.docs.map(d => {
      const s = d.data();
      return {
        id: d.id,
        stockRecovered: !!s.stockRecovered,
        stockDecrementedAt: s.stockDecrementedAt || null,
        items: (s.items || []).map(i => ({ id: i.id || i.productId || null, name: i.name, qty: i.quantity || i.qty || 0 }))
      };
    });

    const unrecovered = sales.filter(s => !s.stockRecovered && !s.stockDecrementedAt);

    return json(200, {
      profileId,
      products,
      salesCount: sales.length,
      sales: sales.slice(0, 50),
      unrecoveredCount: unrecovered.length,
      unrecovered: unrecovered.slice(0, 20)
    });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
