const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  const code = String(input.code || "").trim().toUpperCase();
  if (!code) return json(400, { error: "Code requis" });

  try {
    const db = admin.firestore();
    const affSnap = await db.doc(`affiliates/${code}`).get();
    if (!affSnap.exists) return json(404, { error: "Affilié introuvable" });

    const q = await db.collection("profiles").where("referredBy", "==", code).get();
    const referrals = q.docs.map((d) => {
      const p = d.data();
      return {
        uid: d.id,
        establishmentName: p.establishmentName || "—",
        ownerName: p.ownerName,
        plan: p.plan,
        createdAt: p.createdAt,
      };
    });

    return json(200, { success: true, referrals });
  } catch (error) {
    return json(500, { error: error.message || "Erreur" });
  }
};
