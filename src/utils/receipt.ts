import jsPDF from "jspdf";

import type { UserProfile } from "@/types/profile";

export interface SubscriptionReceiptOptions {
  amountXaf: number;
  paidAt: number; // epoch ms
  paymentMethod?: string; // e.g., Airtel Money
  reference?: string; // e.g., abonnement
}

export async function generateSubscriptionReceiptPDF(profile: Pick<
  UserProfile,
  "establishmentName" | "email" | "phone" | "logoUrl" | "uid" | "companyName" | "fullAddress" | "businessPhone" | "rcsNumber" | "nifNumber" | "legalMentions" | "customMessage"
>, opts: SubscriptionReceiptOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;

  // Header
  const logoUrl = profile.logoUrl || "/Design sans titre.svg";
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const img = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = (error) => {
          console.error('Erreur lecture logo:', error);
          reject(error);
        };
        reader.readAsDataURL(img);
      });
      // Détecter le format de l'image
      const format = img.type.includes('jpeg') || img.type.includes('jpg') ? 'JPEG' : 'PNG';
      doc.addImage(dataUrl, format, 40, y - 10, 48, 48);
    } catch (error) {
      console.error('Erreur chargement logo pour reçu:', error);
      // Continuer sans logo plutôt que d'ignorer silencieusement
    }
  }
  doc.setFontSize(18);
  // Nom du bar (ou nom de la structure si défini)
  const displayName = profile.companyName || profile.establishmentName || "Mon Établissement";
  doc.text(displayName, 100, y + 10);
  doc.setFontSize(11);

  // Adresse (si renseignée)
  if (profile.fullAddress) {
    y += 16;
    doc.text(profile.fullAddress, 100, y + 10);
  }

  // Téléphone professionnel (ou téléphone par défaut)
  const displayPhone = profile.businessPhone || profile.phone;
  if (displayPhone) {
    y += 16;
    doc.text(displayPhone, 100, y + 10);
  }

  // Numéro RCS (si renseigné)
  if (profile.rcsNumber) {
    y += 16;
    doc.text(`RCS: ${profile.rcsNumber}`, 100, y + 10);
  }

  // Numéro NIF (si renseigné)
  if (profile.nifNumber) {
    y += 16;
    doc.text(`NIF: ${profile.nifNumber}`, 100, y + 10);
  }

  // Email (si pas déjà affiché)
  if (profile.email && !displayPhone) {
    y += 16;
    doc.text(profile.email, 100, y + 10);
  }

  // Title
  y += 40;
  doc.setDrawColor(230); doc.setLineWidth(1); doc.line(40, y, 555, y); y += 24;
  doc.setFontSize(16);
  doc.text("Reçu d'abonnement", 40, y); y += 20;

  // Receipt details
  const paidDate = new Date(opts.paidAt).toLocaleString();
  doc.setFontSize(12);
  doc.text(`Montant: ${opts.amountXaf.toLocaleString()} XAF`, 40, y); y += 16;
  if (opts.paymentMethod) { doc.text(`Méthode: ${opts.paymentMethod}`, 40, y); y += 16; }
  if (opts.reference) { doc.text(`Référence: ${opts.reference}`, 40, y); y += 16; }
  doc.text(`Date de paiement: ${paidDate}`, 40, y); y += 16;
  doc.text(`Compte: ${profile.uid}`, 40, y);

  // Mentions légales (si renseignées)
  if (profile.legalMentions) {
    y += 30;
    doc.setFontSize(9);
    doc.setTextColor(100);
    const maxWidth = 475; // Largeur disponible pour le texte
    const words = profile.legalMentions.split(' ');
    let currentLine = '';
    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);
      if (testWidth > maxWidth && currentLine) {
        doc.text(currentLine, 40, y);
        y += 12;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      doc.text(currentLine, 40, y);
      y += 12;
    }
  }

  // Footer
  y += 30;
  doc.setFontSize(10);
  doc.setTextColor(120);
  // Message personnalisé (si renseigné) ou message par défaut
  const footerMessage = profile.customMessage || "Merci pour votre confiance. Votre abonnement est actif pour 30 jours.";
  doc.text(footerMessage, 40, y);

  // Save
  const fileName = `recu-abonnement-${new Date(opts.paidAt).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}


