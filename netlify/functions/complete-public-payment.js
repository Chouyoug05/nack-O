const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  const transactionId = String(input.transactionId || "").trim();
  if (!transactionId || transactionId.length < 8) {
    return json(400, { error: "transactionId requis" });
  }

  try {
    const db = admin.firestore();
    const snap = await db.collectionGroup("payments")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (snap.empty) return json(404, { error: "Transaction introuvable" });

    const paymentDoc = snap.docs[0];
    const payment = paymentDoc.data();
    const pathParts = paymentDoc.ref.path.split("/");
    const establishmentId = payment.establishmentId || pathParts[1];

    if (payment.status === "completed") {
      return json(200, { success: true, alreadyCompleted: true, establishmentId });
    }

    const now = Date.now();
    await paymentDoc.ref.update({ status: "completed", paidAt: now, updatedAt: now });

    const subType = String(payment.subscriptionType || "");

    // Billet événement
    if (subType === "event-ticket" && payment.ticketData && payment.eventId && establishmentId) {
      const td = payment.ticketData;
      const qty = Number(td.quantity || 0);
      const ticketsCol = db.collection(`profiles/${establishmentId}/events/${payment.eventId}/tickets`);
      await ticketsCol.add({
        customerName: String(td.customerName || ""),
        customerEmail: String(td.customerEmail || ""),
        customerPhone: String(td.customerPhone || ""),
        quantity: qty,
        totalAmount: Number(td.totalAmount || 0),
        status: "paid",
        purchaseDate: now,
      });
      const evtRef = db.doc(`profiles/${establishmentId}/events/${payment.eventId}`);
      await evtRef.update({ ticketsSold: admin.firestore.FieldValue.increment(qty) });
      return json(200, { success: true, establishmentId, type: "event-ticket" });
    }

    // Abonnement : activation via serveur uniquement
    if (subType === "transition" || subType === "transition-pro-max") {
      const userId = payment.userId || pathParts[1];
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const endsAt = now + thirtyDays;
      const updateData = {
        plan: "active",
        subscriptionType: subType,
        subscriptionEndsAt: endsAt,
        lastPaymentAt: now,
        updatedAt: now,
      };
      if (subType === "transition-pro-max") {
        updateData.eventsCount = 0;
        updateData.eventsResetAt = endsAt;
      }
      await db.doc(`profiles/${userId}`).update(updateData);

      const pubSnap = await db.doc(`profiles/${userId}`).get();
      if (pubSnap.exists) {
        const p = pubSnap.data();
        await db.doc(`publicProfiles/${userId}`).set(
          {
            uid: userId,
            establishmentName: p.establishmentName || "Établissement",
            establishmentType: p.establishmentType,
            logoUrl: p.logoUrl,
            ownerName: p.ownerName,
            address: p.address,
            fullAddress: p.fullAddress,
            latitude: p.latitude,
            longitude: p.longitude,
            paymentsEnabled: p.disbursementStatus === "approved" && Boolean(p.disbursementId),
            updatedAt: now,
          },
          { merge: true }
        );
      }

      return json(200, { success: true, establishmentId: userId, type: subType });
    }

    // Commande menu digital / boutique en ligne
    if (subType === "order") {
      const batch = db.batch();

      // Mettre à jour la commande liée : awaiting-payment → paid
      if (payment.orderId) {
        const orderRef = db.doc(`profiles/${establishmentId}/orders/${payment.orderId}`);
        batch.update(orderRef, {
          status: "paid",
          paymentStatus: "paid",
          paymentMethod: String(payment.method || "mobile"),
          paidAt: now,
          updatedAt: now,
        });
      }

      // Notification in-app pour l'établissement
      const notifRef = db.collection(`profiles/${establishmentId}/notifications`).doc();
      const items = Array.isArray(payment.items) ? payment.items : [];
      const itemsLabel = items.length
        ? items.map((it) => `${it.quantity || 1}x ${it.name || "Article"}`).join(", ").slice(0, 120)
        : "Commande menu digital";
      batch.set(notifRef, {
        title: "Commande payée en ligne",
        message: `Nouvelle commande payée (${Number(payment.amount || 0).toLocaleString("fr-FR")} XAF) : ${itemsLabel}`,
        type: "order",
        orderId: payment.orderId || null,
        paymentMethod: String(payment.method || "mobile"),
        amount: Number(payment.amount || 0),
        read: false,
        createdAt: now,
      });

      await batch.commit();

      // Push FCM (best effort — ne bloque pas la confirmation)
      try {
        const profSnap = await db.doc(`profiles/${establishmentId}`).get();
        const token = String(profSnap.data()?.fcmToken || "").trim();
        if (token) {
          await admin.messaging().send({
            notification: {
              title: "Commande payée en ligne",
              body: `${itemsLabel} — ${Number(payment.amount || 0).toLocaleString("fr-FR")} XAF`,
            },
            data: { type: "order", orderId: String(payment.orderId || "") },
            token,
            android: { priority: "high", notification: { sound: "default" } },
          });
        }
      } catch (pushErr) {
        console.error("FCM push (order) failed:", pushErr);
      }

      return json(200, { success: true, establishmentId, type: "order", orderId: payment.orderId || null });
    }

    return json(200, { success: true, establishmentId, type: subType || "unknown" });
  } catch (error) {
    console.error("complete-public-payment:", error);
    return json(500, { error: error.message || "Erreur traitement paiement" });
  }
};
