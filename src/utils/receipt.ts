import { publicAssetUrl } from "@/lib/assets";

import jsPDF from "jspdf";

import type { UserProfile } from "@/types/profile";

export interface SubscriptionReceiptOptions {
  amountXaf: number;
  paidAt: number; // epoch ms
  paymentMethod?: string; // e.g., Airtel Money
  reference?: string; // e.g., abonnement
}

export interface OrderReceiptOptions {
  orderNumber: number | string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    category?: string;
  }>;
  subtotal: number;
  deliveryPrice?: number;
  total: number;
  tableNumber?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: number;
  createdAt?: number;
  status?: string;
}

export async function generateSubscriptionReceiptPDF(profile: Pick<
  UserProfile,
  "establishmentName" | "email" | "phone" | "logoUrl" | "uid" | "companyName" | "fullAddress" | "businessPhone" | "rcsNumber" | "nifNumber" | "legalMentions" | "customMessage"
>, opts: SubscriptionReceiptOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;

  // Header
  const logoUrl = profile.logoUrl || publicAssetUrl("Design sans titre.svg");
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

export async function generateOrderReceiptPDF(
  profile: Pick<UserProfile, "establishmentName" | "logoUrl" | "companyName" | "fullAddress" | "businessPhone" | "rcsNumber" | "nifNumber" | "legalMentions" | "customMessage">,
  order: OrderReceiptOptions
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;

  const logoUrl = profile.logoUrl || publicAssetUrl("Design sans titre.svg");
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const img = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(img);
        });
        const format = img.type.includes('jpeg') || img.type.includes('jpg') ? 'JPEG' : 'PNG';
        doc.addImage(dataUrl, format, 40, y - 10, 48, 48);
      }
    } catch { /* skip logo */ }
  }

  doc.setFontSize(18);
  const displayName = profile.companyName || profile.establishmentName || "Établissement";
  doc.text(displayName, 100, y + 10);
  doc.setFontSize(11);

  if (profile.fullAddress) { y += 16; doc.text(profile.fullAddress, 100, y + 10); }
  if (profile.businessPhone) { y += 16; doc.text(profile.businessPhone, 100, y + 10); }
  if (profile.rcsNumber) { y += 16; doc.text(`RCS: ${profile.rcsNumber}`, 100, y + 10); }
  if (profile.nifNumber) { y += 16; doc.text(`NIF: ${profile.nifNumber}`, 100, y + 10); }

  y += 40;
  doc.setDrawColor(230); doc.setLineWidth(1); doc.line(40, y, 555, y); y += 24;

  doc.setFontSize(16);
  doc.text("Reçu de commande", 40, y); y += 24;

  doc.setFontSize(12);
  doc.text(`Commande N° ${order.orderNumber}`, 40, y); y += 18;

  if (order.tableNumber) { doc.text(`Table: ${order.tableNumber}`, 40, y); y += 16; }
  if (order.paymentMethod) { doc.text(`Paiement: ${order.paymentMethod}`, 40, y); y += 16; }
  if (order.paymentReference) { doc.text(`Réf: ${order.paymentReference}`, 40, y); y += 16; }
  
  const dateVal = order.paidAt || order.createdAt || Date.now();
  doc.text(`Date: ${new Date(dateVal).toLocaleString("fr-FR")}`, 40, y); y += 16;

  if (order.status) { doc.text(`Statut: ${order.status}`, 40, y); y += 16; }

  y += 16;
  doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(40, y, 555, y); y += 20;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Article", 40, y);
  doc.text("Qté", 340, y, { align: "right" });
  doc.text("Prix", 420, y, { align: "right" });
  doc.text("Total", 540, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.line(40, y, 555, y); y += 16;

  doc.setFontSize(11);
  for (const item of order.items) {
    const nameLines = doc.splitTextToSize(item.name, 280);
    for (let i = 0; i < nameLines.length; i++) {
      if (i === 0) {
        doc.text(nameLines[i], 40, y);
        doc.text(String(item.quantity), 340, y, { align: "right" });
        doc.text(`${item.price.toLocaleString("fr-FR")}`, 420, y, { align: "right" });
        doc.text(`${(item.price * item.quantity).toLocaleString("fr-FR")}`, 540, y, { align: "right" });
      } else {
        doc.text(nameLines[i], 40, y);
      }
      y += 14;
    }
    y += 4;
  }

  y += 8;
  doc.line(40, y, 555, y); y += 20;

  doc.setFontSize(11);
  doc.text("Sous-total:", 400, y, { align: "right" });
  doc.text(`${order.subtotal.toLocaleString("fr-FR")} XAF`, 540, y, { align: "right" }); y += 16;

  if (order.deliveryPrice && order.deliveryPrice > 0) {
    doc.text("Livraison:", 400, y, { align: "right" });
    doc.text(`${order.deliveryPrice.toLocaleString("fr-FR")} XAF`, 540, y, { align: "right" }); y += 16;
  }

  y += 4;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", 400, y, { align: "right" });
  doc.text(`${order.total.toLocaleString("fr-FR")} XAF`, 540, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (profile.legalMentions) {
    y += 30;
    doc.setFontSize(9);
    doc.setTextColor(100);
    const maxWidth = 475;
    const words = profile.legalMentions.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (doc.getTextWidth(testLine) > maxWidth && currentLine) {
        doc.text(currentLine, 40, y); y += 12;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) { doc.text(currentLine, 40, y); }
  }

  y = Math.max(y + 30, 700);
  doc.setFontSize(10);
  doc.setTextColor(120);
  const footerMsg = profile.customMessage || "Merci pour votre commande !";
  doc.text(footerMsg, 40, y);

  const fileName = `recu-commande-${order.orderNumber}-${new Date(dateVal).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}


