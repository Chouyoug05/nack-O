const { admin } = require("./_firebaseAdmin");
const { json } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const db = admin.firestore();
    const profilesSnap = await db.collection("profiles").get();

    let synced = 0;
    let errors = 0;

    for (const doc of profilesSnap.docs) {
      const profile = doc.data();
      const uid = doc.id;

      const paymentsEnabled =
        profile.disbursementStatus === "approved" && Boolean(String(profile.disbursementId || "").trim());

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
            menuDesignId: profile.menuDesignId,
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
