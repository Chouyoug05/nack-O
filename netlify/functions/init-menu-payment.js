const { admin } = require("./_firebaseAdmin");
const { json, parseBody } = require("./_security");

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

function env(key) {
  const v = process.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

const SINGPAY_CLIENT_ID = env("SINGPAY_CLIENT_ID");
const SINGPAY_CLIENT_SECRET = env("SINGPAY_CLIENT_SECRET");
const SINGPAY_WALLET = env("SINGPAY_WALLET");

async function createSingPayLink(payload) {
  const res = await fetch(SINGPAY_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "x-client-id": SINGPAY_CLIENT_ID,
      "x-client-secret": SINGPAY_CLIENT_SECRET,
      "x-wallet": SINGPAY_WALLET,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 300));
  return JSON.parse(text);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  if (!SINGPAY_CLIENT_ID || !SINGPAY_CLIENT_SECRET || !SINGPAY_WALLET) {
    return json(500, { error: "SingPay non configuré côté serveur" });
  }

  const input = parseBody(event);
  if (!input) return json(400, { error: "JSON invalide" });

  const establishmentId = String(input.establishmentId || "").trim();
  const amount = Math.round(Number(input.amount));
  const reference = String(input.reference || "").trim();
  const redirectSuccess = String(input.redirectSuccess || "").trim();
  const redirectError = String(input.redirectError || "").trim();
  const logoURL = String(input.logoURL || "").trim();
  const transactionId = String(input.transactionId || "").trim();
  const orderData = input.orderData;

  if (!establishmentId || !reference || !transactionId) {
    return json(400, { error: "establishmentId, reference et transactionId requis" });
  }
  if (!Number.isFinite(amount) || amount < 100 || amount > 50000000) {
    return json(400, { error: "Montant invalide" });
  }

  try {
    const db = admin.firestore();
    const profSnap = await db.doc(`profiles/${establishmentId}`).get();
    if (!profSnap.exists) return json(404, { error: "Établissement introuvable" });

    const prof = profSnap.data();
    const disbursementId = String(prof.disbursementId || "").trim();
    if (!disbursementId || prof.disbursementStatus !== "approved") {
      return json(403, { error: "Paiements non activés pour cet établissement" });
    }

    const paymentRef = db.collection(`profiles/${establishmentId}/payments`).doc();
    await paymentRef.set({
      userId: establishmentId,
      transactionId,
      subscriptionType: "menu-digital",
      amount,
      status: "pending",
      paymentMethod: "airtel-money",
      reference,
      paymentLink: "",
      redirectSuccess,
      redirectError,
      establishmentId,
      disbursementId,
      orderData: orderData || null,
      createdAt: Date.now(),
    });

    const singpay = await createSingPayLink({
      reference,
      redirect_success: redirectSuccess,
      redirect_error: redirectError,
      amount,
      logoURL,
      isTransfer: false,
      portefeuille: SINGPAY_WALLET,
      disbursement: disbursementId,
    });

    if (!singpay.link) {
      console.error('[SingPay] No link in response:', JSON.stringify(singpay).slice(0, 500));
      return json(502, { error: "Lien de paiement introuvable" });
    }

    console.log('[SingPay] Payment link created:', singpay.link);
    await paymentRef.update({ paymentLink: singpay.link, updatedAt: Date.now() });

    return json(200, { link: singpay.link, exp: singpay.exp, paymentId: paymentRef.id });
  } catch (e) {
    return json(500, { error: "Erreur init paiement menu", detail: e.message || String(e) });
  }
};
