import { isElectronRenderer } from "@/lib/platform";

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

const DEFAULT_NETLIFY_PROXY = "/.netlify/functions/create-payment-link";

function trimEnv(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length ? t : undefined;
}

/** URL du proxy si applicable (hors Electron ; pas de chemin relatif sur file://). */
function resolvePaymentProxyUrl(): string | undefined {
  const fromEnv = trimEnv(import.meta.env.VITE_PAYMENT_PROXY_URL);
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return undefined;
  if (isElectronRenderer()) return undefined;
  const proto = window.location.protocol;
  if (proto !== "http:" && proto !== "https:") return undefined;
  return DEFAULT_NETLIFY_PROXY;
}

function readSingPayCredentials() {
  return {
    clientId: trimEnv(import.meta.env.VITE_SINGPAY_CLIENT_ID) || "",
    clientSecret: trimEnv(import.meta.env.VITE_SINGPAY_CLIENT_SECRET) || "",
    wallet: trimEnv(import.meta.env.VITE_SINGPAY_WALLET) || "",
    disbursementDefault: trimEnv(import.meta.env.VITE_SINGPAY_DISBURSEMENT) || "",
  };
}

function singPayPayload(params: CreatePaymentLinkParams) {
  const { wallet, disbursementDefault } = readSingPayCredentials();
  return {
    portefeuille: wallet,
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount: params.amount,
    disbursement: params.disbursement || disbursementDefault || undefined,
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  };
}

async function requestPaymentLinkViaProxy(proxyUrl: string, params: CreatePaymentLinkParams): Promise<string> {
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(singPayPayload(params)),
    credentials: "omit",
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as CreatePaymentLinkResponse;
  if (!data.link) throw new Error("Lien de paiement introuvable");
  return data.link;
}

async function requestPaymentLinkDirect(params: CreatePaymentLinkParams): Promise<string> {
  const { clientId, clientSecret, wallet } = readSingPayCredentials();
  if (!clientId || !clientSecret || !wallet) {
    throw new Error(
      "Paiement indisponible: configurez VITE_PAYMENT_PROXY_URL (recommandé) ou VITE_SINGPAY_CLIENT_ID / SECRET / WALLET pour l'appel direct.",
    );
  }
  const res = await fetch(SINGPAY_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-wallet": wallet,
    },
    body: JSON.stringify(singPayPayload(params)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SingPay error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as CreatePaymentLinkResponse;
  if (!data.link) throw new Error("Lien de paiement introuvable");
  return data.link;
}

export async function createSubscriptionPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const proxyUrl = resolvePaymentProxyUrl();

  if (proxyUrl) {
    try {
      return await requestPaymentLinkViaProxy(proxyUrl, params);
    } catch (e) {
      // GitHub Pages / Electron : pas de Netlify Functions sur l'origine courante → repli direct si clés présentes
      const { clientId, clientSecret, wallet } = readSingPayCredentials();
      if (clientId && clientSecret && wallet) {
        return await requestPaymentLinkDirect(params);
      }
      throw e;
    }
  }

  return await requestPaymentLinkDirect(params);
} 