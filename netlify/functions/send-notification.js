const { admin } = require("./_firebaseAdmin");
const { json, parseBody, checkInternalSecret } = require("./_security");

// --- Taux limite simple en mémoire (par instance de fonction) ---------------
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

function clientIp(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    h["client-ip"] ||
    (h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown"
  );
}

function isRateLimited(event) {
  const ip = clientIp(event);
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return bucket.count > RATE_LIMIT_MAX;
}

/** Vérifie un éventuel jeton Firebase (Authorization: Bearer <idToken>). */
async function verifyFirebaseToken(event) {
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  try {
    return await admin.auth().verifyIdToken(m[1]);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  if (isRateLimited(event)) {
    return json(429, { error: "Trop de requêtes, réessayez plus tard." });
  }

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  try {
    const db = admin.firestore();

    const isInternal = checkInternalSecret(event);
    const decoded = isInternal ? null : await verifyFirebaseToken(event);

    const establishmentId = typeof input.establishmentId === "string" ? input.establishmentId.trim() : "";
    if (!establishmentId) {
      return json(400, { error: "establishmentId requis" });
    }

    // Vérifier que l'établissement existe (évite le spam sur des ID arbitraires).
    const profSnap = await db.doc(`profiles/${establishmentId}`).get();
    if (!profSnap.exists) {
      return json(404, { error: "Établissement introuvable" });
    }

    const data = input.data && typeof input.data === "object" ? input.data : {};
    const type = String(data.type || "info");

    // Appel anonyme (menu QR public) : uniquement les notifications de commande.
    if (!isInternal && !decoded && type !== "order") {
      return json(403, { error: "Authentification requise pour ce type de notification" });
    }

    // Le token FCM explicite n'est accepté QUE depuis un appel interne.
    let token = "";
    if (isInternal && typeof input.token === "string") {
      token = input.token.trim();
    }
    if (!token) {
      token = String(profSnap.data().fcmToken || "").trim();
    }

    const title = String(input.title || "Nack-O").slice(0, 120);
    const body = String(input.body || "Nouvelle notification").slice(0, 240);

    try {
      await db.collection(`profiles/${establishmentId}/notifications`).add({
        title,
        message: body,
        type,
        orderId: data.orderId ? String(data.orderId) : null,
        orderNumber: data.orderNumber ? Number(data.orderNumber) : null,
        targetRole: String(input.targetRole || ""),
        read: false,
        createdAt: Date.now(),
      });
    } catch (notifErr) {
      console.error("send-notification: Firestore notif error:", notifErr);
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
