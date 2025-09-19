export interface CreatePaymentLinkParams {
  amount: number; // en XAF
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  isTransfer?: boolean;
}

interface CreatePaymentLinkResponse {
  link: string;
  exp: string;
}

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

const SINGPAY_CLIENT_ID = import.meta.env.VITE_SINGPAY_CLIENT_ID || "";
const SINGPAY_CLIENT_SECRET = import.meta.env.VITE_SINGPAY_CLIENT_SECRET || "";
const SINGPAY_WALLET = import.meta.env.VITE_SINGPAY_WALLET || "";
const SINGPAY_DISBURSEMENT = import.meta.env.VITE_SINGPAY_DISBURSEMENT || "";

export async function createSubscriptionPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const body = {
    portefeuille: SINGPAY_WALLET,
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount: params.amount,
    disbursement: SINGPAY_DISBURSEMENT,
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  };

  // Proxy backend si disponible (Netlify/Vercel)
  const isNetlifyHost = typeof window !== 'undefined' && /\.netlify\.app$/i.test(window.location.hostname);
  const proxyUrl = (
    isNetlifyHost ? '/.netlify/functions/create-payment-link' : undefined
  ) || import.meta.env.VITE_PAYMENT_PROXY_URL;

  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Proxy error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as CreatePaymentLinkResponse;
    if (!data.link) throw new Error("Lien de paiement introuvable");
    return data.link;
  }

  const res = await fetch(SINGPAY_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "x-client-id": SINGPAY_CLIENT_ID,
      "x-client-secret": SINGPAY_CLIENT_SECRET,
      "x-wallet": SINGPAY_WALLET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SingPay error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as CreatePaymentLinkResponse;
  if (!data.link) throw new Error("Lien de paiement introuvable");
  return data.link;
} 