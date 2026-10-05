/**
 * Contrat partagé du QR code des billets d'événements.
 * Le même identifiant est encodé dans le QR imprimé et stocké sur le billet
 * Firestore, ce qui permet de retrouver et valider un billet au scan.
 */
export function generateTicketQrToken(prefix = "NACK"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}
