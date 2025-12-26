export interface CreatePaymentLinkParams {
  amount: number; // en XAF
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  isTransfer?: boolean;
  disbursement?: string; // Disbursement ID pour recevoir l'argent
}

interface CreatePaymentLinkResponse {
  link: string;
  exp: string;
}

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

export async function createSubscriptionPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const body = {
    portefeuille: undefined as unknown as string, // set later if needed
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount: params.amount,
    disbursement: params.disbursement || undefined as unknown as string, // set later if needed
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  } as Record<string, unknown>;

  // Préférer un proxy backend (Netlify/Vercel). Si VITE_PAYMENT_PROXY_URL est fourni, l'utiliser.
  // Sinon, tenter le chemin Netlify par défaut (/.netlify/functions/create-payment-link) pour tout domaine web.
  const proxyUrl = import.meta.env.VITE_PAYMENT_PROXY_URL || '/.netlify/functions/create-payment-link';

  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portefeuille: undefined,
        reference: params.reference,
        redirect_success: params.redirectSuccess,
        redirect_error: params.redirectError,
        amount: params.amount,
        disbursement: params.disbursement || undefined,
        logoURL: params.logoURL,
        isTransfer: params.isTransfer ?? false,
      }),
      credentials: 'omit',
      mode: 'cors',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Proxy error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as CreatePaymentLinkResponse;
    if (!data.link) throw new Error("Lien de paiement introuvable");
    return data.link;
  }

  // Fallback dev uniquement (appel direct)
  if (import.meta.env.DEV) {
    const SINGPAY_CLIENT_ID = import.meta.env.VITE_SINGPAY_CLIENT_ID || "";
    const SINGPAY_CLIENT_SECRET = import.meta.env.VITE_SINGPAY_CLIENT_SECRET || "";
    const SINGPAY_WALLET = import.meta.env.VITE_SINGPAY_WALLET || "";
    const SINGPAY_DISBURSEMENT = import.meta.env.VITE_SINGPAY_DISBURSEMENT || "";

    const devBody = {
      portefeuille: SINGPAY_WALLET,
      reference: params.reference,
      redirect_success: params.redirectSuccess,
      redirect_error: params.redirectError,
      amount: params.amount,
      disbursement: params.disbursement || SINGPAY_DISBURSEMENT,
      logoURL: params.logoURL,
      isTransfer: params.isTransfer ?? false,
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
      body: JSON.stringify(devBody),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SingPay error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as CreatePaymentLinkResponse;
    if (!data.link) throw new Error("Lien de paiement introuvable");
    return data.link;
  }

  throw new Error("Paiement indisponible: configurez VITE_PAYMENT_PROXY_URL ou Netlify Functions");
} 