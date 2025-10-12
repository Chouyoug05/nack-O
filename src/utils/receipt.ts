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
  "establishmentName" | "email" | "phone" | "logoUrl" | "uid"
>, opts: SubscriptionReceiptOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;

  // Header
  if (profile.logoUrl) {
    try {
      const img = await fetch(profile.logoUrl).then((r) => r.blob());
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(img);
      });
      doc.addImage(dataUrl, "PNG", 40, y - 10, 48, 48);
    } catch {
      // ignore logo load errors
    }
  }
  doc.setFontSize(18);
  doc.text(profile.establishmentName || "Mon Établissement", 100, y + 10);
  doc.setFontSize(11);
  const contacts = [profile.email, profile.phone].filter(Boolean).join(" • ");
  if (contacts) { y += 16; doc.text(contacts, 100, y + 10); }

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

  // Footer
  y += 40;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Merci pour votre confiance. Votre abonnement est actif pour 30 jours.", 40, y);

  // Save
  const fileName = `recu-abonnement-${new Date(opts.paidAt).toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);
}


