/**
 * Fonctions de paiement pour les billets d'événement
 * Utilise SingPay avec Disbursement ID pour recevoir l'argent sur Airtel Money
 */

import { createSubscriptionPaymentLink, type CreatePaymentLinkParams } from "./singpay";

export interface CreateEventPaymentParams {
  amount: number; // Montant en XAF
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  disbursementId: string; // Disbursement ID de l'établissement propriétaire de l'événement
}

/**
 * Crée un lien de paiement pour un billet d'événement
 * L'argent sera automatiquement transféré sur le compte Airtel Money de l'établissement
 */
export async function createEventPaymentLink(
  params: CreateEventPaymentParams
): Promise<string> {
  const paymentParams: CreatePaymentLinkParams = {
    amount: params.amount,
    reference: params.reference,
    redirectSuccess: params.redirectSuccess,
    redirectError: params.redirectError,
    logoURL: params.logoURL,
    isTransfer: false,
    disbursement: params.disbursementId, // Utiliser le Disbursement ID de l'établissement
  };

  return await createSubscriptionPaymentLink(paymentParams);
}

