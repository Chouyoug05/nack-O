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
const APEX_PAYMENT_PROXY = "https://nack.pro/.netlify/functions/create-payment-link";

function trimEnv(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length ? t : undefined;
}

function canonicalizeProxyUrl(url: string): string {
  return url.replace("://www.nack.pro", "://nack.pro");
}

/** URL du proxy si applicable (hors Electron ; pas de chemin relatif sur file://). */
function resolvePaymentProxyUrl(): string | undefined {
  const fromEnv = trimEnv(import.meta.env.VITE_PAYMENT_PROXY_URL);
  if (fromEnv) return canonicalizeProxyUrl(fromEnv);

  if (typeof window === "undefined") return undefined;
  if (isElectronRenderer()) return undefined;

  const proto = window.location.protocol;
  if (proto !== "http:" && proto !== "https:") return undefined;

  // www.nack.pro renvoie 308 sur les POST Functions → utiliser l'apex
  const host = window.location.hostname.toLowerCase();
  if (host === "www.nack.pro" || host === "nack.pro") {
    return APEX_PAYMENT_PROXY;
  }

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
  const amount = Math.round(Number(params.amount) || 0);
  const payload: Record<string, unknown> = {
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount,
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  };
  if (wallet) payload.portefeuille = wallet;
  const disbursement = params.disbursement || disbursementDefault;
  if (disbursement) payload.disbursement = disbursement;
  return payload;
}

function parseProxyError(status: number, text: string): string {
  try {
    const j = JSON.parse(text) as { error?: string; detail?: string; hint?: string; message?: string };
    const parts = [j.error || j.message, j.detail, j.hint].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  } catch { /* plain text */ }
  if (text && text.length < 240 && !text.trim().startsWith("<")) return text;
  return `Erreur serveur paiement (${status})`;
}

async function requestPaymentLinkViaProxy(proxyUrl: string, params: CreatePaymentLinkParams): Promise<string> {
  const amount = Math.round(Number(params.amount) || 0);
  if (!amount || amount < 100) {
    throw new Error("Montant de paiement invalide");
  }

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(singPayPayload(params)),
    credentials: "omit",
    mode: "cors",
    redirect: "follow",
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(parseProxyError(res.status, text));
  }
  let data: CreatePaymentLinkResponse;
  try {
    data = JSON.parse(text) as CreatePaymentLinkResponse;
  } catch {
    throw new Error("Réponse paiement invalide");
  }
  if (!data.link) throw new Error("Lien de paiement introuvable");
  return data.link;
}

async function requestPaymentLinkDirect(params: CreatePaymentLinkParams): Promise<string> {
  const { clientId, clientSecret, wallet } = readSingPayCredentials();
  if (!clientId || !clientSecret || !wallet) {
    throw new Error("Paiement temporairement indisponible. Réessayez dans un instant.");
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
    throw new Error(parseProxyError(res.status, text));
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
      // Repli : appel direct si les clés front sont présentes
      const { clientId, clientSecret, wallet } = readSingPayCredentials();
      if (clientId && clientSecret && wallet) {
        try {
          return await requestPaymentLinkDirect(params);
        } catch {
          throw e;
        }
      }
      throw e;
    }
  }

  return await requestPaymentLinkDirect(params);
}
