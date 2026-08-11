import { isElectronRenderer } from "@/lib/platform";

export interface CreatePaymentLinkParams {
  amount: number;
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  isTransfer?: boolean;
  disbursement?: string;
}

interface CreatePaymentLinkResponse {
  link: string;
  exp: string;
}

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

function resolvePaymentProxyUrl(): string | undefined {
  const fromEnv = trimEnv(import.meta.env.VITE_PAYMENT_PROXY_URL);
  if (fromEnv) return canonicalizeProxyUrl(fromEnv);

  if (typeof window === "undefined") return undefined;
  if (isElectronRenderer()) return undefined;

  const proto = window.location.protocol;
  if (proto !== "http:" && proto !== "https:") return undefined;

  const host = window.location.hostname.toLowerCase();
  if (host === "www.nack.pro" || host === "nack.pro") {
    return APEX_PAYMENT_PROXY;
  }

  return DEFAULT_NETLIFY_PROXY;
}

function singPayPayload(params: CreatePaymentLinkParams) {
  const amount = Math.round(Number(params.amount) || 0);
  const payload: Record<string, unknown> = {
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount,
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  };
  if (params.disbursement) payload.disbursement = params.disbursement;
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

export async function createSubscriptionPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const proxyUrl = resolvePaymentProxyUrl();
  if (!proxyUrl) {
    throw new Error("Paiement indisponible. Utilisez la version web de Nack.");
  }
  return requestPaymentLinkViaProxy(proxyUrl, params);
}
