const { admin } = require("./_firebaseAdmin");
const { json, parseBody, checkInternalSecret } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Nack-Internal-Secret", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  if (!checkInternalSecret(event)) {
    return json(401, { error: "Secret interne requis" });
  }

  const input = parseBody(event);
  const dryRun = input && input.dryRun === true;

  try {
    const db = admin.firestore();
    
    const profilesSnapshot = await db.collection("profiles").get();
    const profiles = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const results = {
      totalProfiles: profiles.length,
      totalClosedOrders: 0,
      totalStockUpdated: 0,
      errors: [],
      details: []
    };

    for (const profile of profiles) {
      const uid = profile.id;
      const profileResult = { uid, establishmentName: profile.establishmentName || 'Sans nom', orders: [] };

      try {
        const ordersSnapshot = await db.collection(`profiles/${uid}/orders`).where("status", "==", "closed").get();
        
        if (ordersSnapshot.empty) continue;

        const productsSnapshot = await db.collection(`profiles/${uid}/products`).get();
        const productsMap = new Map();
        productsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.name) {
            productsMap.set(data.name.toLowerCase(), { id: doc.id, quantity: data.quantity || 0, name: data.name });
          }
        });

        for (const orderDoc of ordersSnapshot.docs) {
          const order = orderDoc.data();
          const orderInfo = {
            orderId: orderDoc.id,
            orderNumber: order.orderNumber,
            items: [],
            missingProducts: []
          };

          if (!order.items || order.items.length === 0) continue;

          const batch = db.batch();
          let hasUpdates = false;

          for (const item of order.items) {
            const product = productsMap.get(String(item.name || "").toLowerCase());
            
            if (product) {
              const newQuantity = product.quantity - (item.quantity || 0);
              orderInfo.items.push({
                name: item.name,
                quantity: item.quantity,
                oldStock: product.quantity,
                newStock: newQuantity
              });

              if (!dryRun) {
                const productRef = db.doc(`profiles/${uid}/products/${product.id}`);
                batch.update(productRef, {
                  quantity: admin.firestore.FieldValue.increment(-(item.quantity || 0)),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                hasUpdates = true;
                productsMap.get(item.name.toLowerCase()).quantity = newQuantity;
              }
            } else {
              orderInfo.missingProducts.push(item.name);
            }
          }

          if (hasUpdates && !dryRun) {
            await batch.commit();
            results.totalStockUpdated++;
          }

          if (orderInfo.items.length > 0 || orderInfo.missingProducts.length > 0) {
            profileResult.orders.push(orderInfo);
            results.totalClosedOrders++;
          }
        }
      } catch (err) {
        results.errors.push({ uid, error: err.message });
      }

      if (profileResult.orders.length > 0) {
        results.details.push(profileResult);
      }
    }

    return json(200, {
      success: true,
      dryRun,
      summary: {
        totalProfiles: results.totalProfiles,
        totalClosedOrders: results.totalClosedOrders,
        totalStockUpdated: dryRun ? results.totalClosedOrders : results.totalStockUpdated,
        errorsCount: results.errors.length
      },
      errors: results.errors,
      details: results.details
    });
  } catch (error) {
    console.error("fix-stock-for-closed-orders error:", error);
    return json(500, { error: error.message || "Erreur lors de la récupération du stock" });
  }
};
