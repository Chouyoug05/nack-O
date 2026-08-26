import type { Handler } from "@netlify/functions";
import { admin } from "./_firebaseAdmin";

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

function env(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

const SINGPAY_CLIENT_ID = env("SINGPAY_CLIENT_ID");
const SINGPAY_CLIENT_SECRET = env("SINGPAY_CLIENT_SECRET");
const SINGPAY_WALLET = env("SINGPAY_WALLET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

interface EstablishmentPayInfo {
  disbursementId: string;
  establishmentName: string;
}

/**
 * Résout le NIS distributeur de l'établissement CÔTÉ SERVEUR.
 * Le client n'a JAMAIS le droit de choisir le bénéficiaire : on ignore
 * tout `disbursement`/`portefeuille` envoyé par le front.
 */
async function resolveEstablishmentPayInfo(establishmentId: string): Promise<EstablishmentPayInfo | null> {
  if (!establishmentId) return null;
  try {
    const snap = await admin.firestore().doc(`profiles/${establishmentId}`).get();
    if (!snap.exists) return null;
    const p = snap.data() || {};
    const approved = p.disbursementStatus === "approved";
    const nis = String(p.disbursementId || "").trim();
    if (!approved || !nis) return null;
    return { disbursementId: nis, establishmentName: String(p.establishmentName || "") };
  } catch {
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    if (!SINGPAY_CLIENT_ID || !SINGPAY_CLIENT_SECRET || !SINGPAY_WALLET) {
      return json(500, {
        error: "SingPay non configuré côté serveur",
        hint:
          "Définissez SINGPAY_CLIENT_ID, SINGPAY_CLIENT_SECRET et SINGPAY_WALLET dans Netlify → Environment variables (sans préfixe VITE_), puis redéployez.",
        missing: {
          clientId: !SINGPAY_CLIENT_ID,
          clientSecret: !SINGPAY_CLIENT_SECRET,
          wallet: !SINGPAY_WALLET,
        },
      });
    }

    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(event.body || "{}") as Record<string, unknown>;
    } catch {
      return json(400, { error: "Corps JSON invalide" });
    }

    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 100) {
      return json(400, { error: "Montant invalide", amount: input.amount });
    }

    // Routage vers le NIS de l'établissement (source de vérité : Firestore)
    const establishmentId = typeof input.establishmentId === "string" ? input.establishmentId.trim() : "";
    const payInfo = await resolveEstablishmentPayInfo(establishmentId);
    if (establishmentId && !payInfo) {
      return json(403, {
        error: "Paiement en ligne indisponible pour cet établissement",
        hint: "Aucun NIS distributeur approuvé n'est associé à cet établissement.",
      });
    }

    const payload: Record<string, unknown> = {
      reference: input.reference || `nack-${Date.now()}`,
      redirect_success: input.redirect_success || input.redirectSuccess || "",
      redirect_error: input.redirect_error || input.redirectError || "",
      amount,
      logoURL: input.logoURL || "",
      isTransfer: Boolean(input.isTransfer),
      portefeuille: SINGPAY_WALLET,
    };
    // Le NIS vient UNIQUEMENT du profil établissement (jamais du client)
    if (payInfo) payload.disbursement = payInfo.disbursementId;

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
    console.log("[create-payment-link] SingPay response", {
      status: res.status,
      body: text.slice(0, 1000),
      payload: { ...payload, portefeuille: "***" },
      hasDisbursement: !!payInfo,
      disbursementId: payInfo?.disbursementId || "(none)",
    });
    if (!res.ok) {
      // Ne pas renvoyer un 500 opaque : message exploitable côté app
      return json(502, {
        error: "Le service de paiement a refusé la demande",
        status: res.status,
        detail: text.slice(0, 500),
      });
    }

    // Renvoyer le JSON SingPay tel quel (attendu: { link, exp })
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      return json(200, data);
    } catch {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: text,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: "Erreur proxy paiement", detail: msg });
  }
};
