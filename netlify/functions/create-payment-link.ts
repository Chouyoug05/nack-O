import type { Handler } from "@netlify/functions";

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

const SINGPAY_CLIENT_ID = process.env.VITE_SINGPAY_CLIENT_ID || "";
const SINGPAY_CLIENT_SECRET = process.env.VITE_SINGPAY_CLIENT_SECRET || "";
const SINGPAY_WALLET = process.env.VITE_SINGPAY_WALLET || "";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    if (!SINGPAY_CLIENT_ID || !SINGPAY_CLIENT_SECRET || !SINGPAY_WALLET) {
      return { statusCode: 500, body: 'SingPay non configuré côté serveur' };
    }
    const input = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const res = await fetch(SINGPAY_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        'x-client-id': SINGPAY_CLIENT_ID,
        'x-client-secret': SINGPAY_CLIENT_SECRET,
        'x-wallet': SINGPAY_WALLET,
      },
      body: JSON.stringify(input),
    });
    const text = await res.text();
    if (!res.ok) {
      return { statusCode: res.status, body: `SingPay error: ${text}` };
    }
    return { statusCode: 200, body: text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { statusCode: 500, body: msg };
  }
}; 