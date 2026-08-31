const { admin } = require("./_firebaseAdmin");
const { json } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const db = admin.firestore();
    const profilesSnap = await db.collection("profiles").get();

    // Pré-charger les configs menu digital (collection menuConfigs)
    let menuConfigsMap = {};
    try {
      const menuSnap = await db.collection("menuConfigs").get();
      for (const doc of menuSnap.docs) {
        const data = doc.data();
        menuConfigsMap[doc.id] = {
          menuConfigEnabled: data.enabled === true,
          menuDesignId: data.selectedDesign || null,
          dailySpecialMode: data.dailySpecialMode === true,
        };
      }
    } catch (e) {
      console.warn("menuConfigs collection not found or empty, skipping:", e.message);
    }

    let synced = 0;
    let errors = 0;

    for (const doc of profilesSnap.docs) {
      const profile = doc.data();
      const uid = doc.id;

      const paymentsEnabled =
        profile.disbursementStatus === "approved" && Boolean(String(profile.disbursementId || "").trim());

      const menuFields = menuConfigsMap[uid] || {};

      try {
        await db.doc(`publicProfiles/${uid}`).set(
          {
            uid,
            establishmentName: profile.establishmentName || "Établissement",
            establishmentType: profile.establishmentType,
            logoUrl: profile.logoUrl,
            ownerName: profile.ownerName,
            address: profile.address,
            fullAddress: profile.fullAddress,
            latitude: profile.latitude,
            longitude: profile.longitude,
            companyName: profile.companyName,
            businessPhone: profile.businessPhone,
            rcsNumber: profile.rcsNumber,
            nifNumber: profile.nifNumber,
            legalMentions: profile.legalMentions,
            customMessage: profile.customMessage,
            ticketLogoUrl: profile.ticketLogoUrl,
            showDeliveryMention: profile.showDeliveryMention,
            showCSSMention: profile.showCSSMention,
            cssPercentage: profile.cssPercentage,
            ticketFooterMessage: profile.ticketFooterMessage,
            deliveryEnabled: profile.deliveryEnabled,
            deliveryPrice: profile.deliveryPrice,
            paymentsEnabled,
            ...menuFields,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
        synced++;
      } catch (e) {
        console.error(`Error syncing ${uid}:`, e.message);
        errors++;
      }
    }

    return json(200, { success: true, synced, errors, total: profilesSnap.size });
  } catch (error) {
    console.error("sync-public-profiles:", error);
    return json(500, { error: error.message || "Erreur synchronisation" });
  }
};
