const crypto = require("crypto");
const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  const identifier = String(input.identifier || input.code || "").trim();
  const password = String(input.password || "").trim();
  if (!identifier || !password) return json(400, { error: "Identifiant et mot de passe requis" });

  try {
    const db = admin.firestore();
    let code = identifier.toUpperCase();
    let affSnap = await db.doc(`affiliates/${code}`).get();

    if (!affSnap.exists) {
      const q = await db.collection("affiliates").where("whatsapp", "==", identifier).limit(1).get();
      if (q.empty) return json(401, { error: "Identifiant inconnu" });
      affSnap = q.docs[0];
      code = affSnap.id;
    }

    const affiliate = affSnap.data();
    const authSnap = await db.doc(`affiliateAuth/${code}`).get();
    const passwordHash = authSnap.exists ? authSnap.data().passwordHash : null;
    const legacyPassword = affiliate.password;

    let ok = false;
    if (passwordHash) {
      ok = hashPassword(password) === passwordHash;
    } else if (legacyPassword) {
      ok = legacyPassword === password;
    } else {
      ok = true;
    }

    if (!ok) return json(401, { error: "Mot de passe incorrect" });

    const { password: _p, ...safeAffiliate } = affiliate;
    return json(200, {
      success: true,
      code,
      affiliate: { id: code, ...safeAffiliate },
    });
  } catch (error) {
    console.error("affiliate-auth:", error);
    return json(500, { error: error.message || "Erreur authentification" });
  }
};
