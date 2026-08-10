import type { Handler } from "@netlify/functions";

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

function env(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

const SINGPAY_CLIENT_ID = env("SINGPAY_CLIENT_ID", "VITE_SINGPAY_CLIENT_ID");
const SINGPAY_CLIENT_SECRET = env("SINGPAY_CLIENT_SECRET", "VITE_SINGPAY_CLIENT_SECRET");
const SINGPAY_WALLET = env("SINGPAY_WALLET", "VITE_SINGPAY_WALLET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
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
          "Définissez SINGPAY_CLIENT_ID, SINGPAY_CLIENT_SECRET et SINGPAY_WALLET (ou les équivalents VITE_*) dans Netlify → Environment variables, puis redéployez.",
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

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { error: "Montant invalide", amount: input.amount });
    }

    const payload = {
      ...input,
      amount,
      portefeuille:
        (typeof input.portefeuille === "string" && input.portefeuille.trim()) ||
        SINGPAY_WALLET,
    };

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
    if (!res.ok) {
      return json(res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: "SingPay a refusé la requête",
        status: res.status,
        detail: text.slice(0, 800),
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
