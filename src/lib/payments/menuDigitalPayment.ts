import { createSubscriptionPaymentLink, type CreatePaymentLinkParams } from "./singpay";

export interface CreateMenuDigitalPaymentParams {
  amount: number;
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  establishmentId: string;
  transactionId: string;
  orderData: Record<string, unknown>;
}

/**
 * Crée un paiement menu digital via le serveur (disbursementId jamais exposé au client).
 */
export async function createMenuDigitalPaymentLink(
  params: CreateMenuDigitalPaymentParams
): Promise<string> {
  const { initMenuPaymentViaServer } = await import("@/lib/securePayment");
  const result = await initMenuPaymentViaServer({
    establishmentId: params.establishmentId,
    amount: params.amount,
    reference: params.reference,
    transactionId: params.transactionId,
    redirectSuccess: params.redirectSuccess,
    redirectError: params.redirectError,
    logoURL: params.logoURL,
    orderData: params.orderData,
  });
  return result.link;
}

/** Abonnements — proxy Netlify existant (utilisateur authentifié). */
export async function createSubscriptionPaymentLinkFromParams(
  params: CreatePaymentLinkParams & { disbursement?: string }
): Promise<string> {
  return createSubscriptionPaymentLink(params);
}
