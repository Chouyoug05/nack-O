// Validation du numéro WhatsApp pour le Gabon
export function validateWhatsApp(phone: string): boolean {
  // Format attendu: +241 suivi de 8 chiffres
  const whatsappRegex = /^\+241[0-9]{8}$/;
  return whatsappRegex.test(phone.replace(/\s/g, ''));
}

// Formatage du numéro WhatsApp pour l'affichage
export function formatWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('+241') && cleaned.length === 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
  }
  return phone;
}

// Message d'erreur pour la validation WhatsApp
export function getWhatsAppErrorMessage(phone: string): string {
  if (!phone) return "Numéro WhatsApp requis";
  if (!validateWhatsApp(phone)) return "Format invalide. Utilisez: +241 suivi de 8 chiffres";
  return "";
}
