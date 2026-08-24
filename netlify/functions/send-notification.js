const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  try {
    const db = admin.firestore();
    let token = typeof input.token === "string" ? input.token.trim() : "";

    const establishmentId = typeof input.establishmentId === "string" ? input.establishmentId.trim() : "";
    if (!token && establishmentId) {
      const profSnap = await db.doc(`profiles/${establishmentId}`).get();
      if (profSnap.exists) {
        token = String(profSnap.data().fcmToken || "").trim();
      }
    }

    const title = String(input.title || "Nack-O").slice(0, 120);
    const body = String(input.body || "Nouvelle notification").slice(0, 240);
    const data = input.data && typeof input.data === "object" ? input.data : {};

    if (establishmentId) {
      try {
        await db.collection(`profiles/${establishmentId}/notifications`).add({
          title,
          message: body,
          type: String(data.type || "info"),
          orderId: data.orderId ? String(data.orderId) : null,
          orderNumber: data.orderNumber ? Number(data.orderNumber) : null,
          targetRole: String(input.targetRole || ""),
          read: false,
          createdAt: Date.now(),
        });
      } catch (notifErr) {
        console.error("send-notification: Firestore notif error:", notifErr);
      }
    }

    if (!token) {
      return json(200, { success: true, fcmSkipped: true, reason: "no-token" });
    }

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
