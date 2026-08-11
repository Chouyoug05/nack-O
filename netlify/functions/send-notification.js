const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  try {
    const db = admin.firestore();
    let token = typeof input.token === "string" ? input.token.trim() : "";

    // Mode sécurisé : lookup FCM via establishmentId (le client n'envoie plus le token)
    const establishmentId = typeof input.establishmentId === "string" ? input.establishmentId.trim() : "";
    if (!token && establishmentId) {
      const profSnap = await db.doc(`profiles/${establishmentId}`).get();
      if (profSnap.exists) {
        token = String(profSnap.data().fcmToken || "").trim();
      }
    }

    if (!token) {
      return json(400, { error: "Aucun token de notification disponible" });
    }

    const title = String(input.title || "Nack-O").slice(0, 120);
    const body = String(input.body || "Nouvelle notification").slice(0, 240);
    const data = input.data && typeof input.data === "object" ? input.data : {};

    const message = {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [String(k), String(v)])
      ),
      token,
      android: {
        priority: "high",
        notification: { sound: "default", clickAction: "FLUTTER_NOTIFICATION_CLICK" },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: { icon: "/favicon.png", requireInteraction: true },
      },
    };

    const messageId = await admin.messaging().send(message);
    return json(200, { success: true, messageId });
  } catch (error) {
    console.error("send-notification error:", error);
    return json(500, { success: false, error: error.message || "Erreur envoi" });
  }
};
