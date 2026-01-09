import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface TicketData {
  orderNumber: string;
  establishmentName: string;
  establishmentLogo?: string;
  tableZone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  createdAt: number;
  receiptData?: {
    orderId: string;
    establishmentId: string;
    timestamp: number;
  };
  // Informations personnalisées pour les tickets
  companyName?: string;
  fullAddress?: string;
  businessPhone?: string;
  rcsNumber?: string;
  nifNumber?: string;
  legalMentions?: string;
  customMessage?: string;
  // Paramètres avancés
  ticketLogoUrl?: string;
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
}

// Couleurs pour ticket simple - NOIR UNIQUEMENT
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

export const generateTicketPDF = async (ticketData: TicketData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // Format ticket 80mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 2; // Marges très faibles
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;

  // Fonction helper pour texte simple
  const text = (
    textStr: string,
    x: number,
    yPos: number,
    size: number = 9,
    bold: boolean = false,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    doc.setFontSize(size);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    
    let xPos = x;
    if (align === 'center') {
      const textWidth = doc.getTextWidth(textStr);
      xPos = (pageWidth - textWidth) / 2;
    } else if (align === 'right') {
      const textWidth = doc.getTextWidth(textStr);
      xPos = pageWidth - margin - textWidth;
    }
    
    doc.text(textStr, xPos, yPos);
  };

  // Fonction pour ligne séparatrice
  const separator = (yPos: number) => {
    doc.setLineWidth(0.1);
    doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // Séparateur initial
  separator(y);
  y += 3;

  // ===== LOGO =====
  const logoUrl = ticketData.ticketLogoUrl || ticketData.establishmentLogo;
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const img = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(img);
        });
        // Détecter le format de l'image
        const format = img.type.includes('jpeg') || img.type.includes('jpg') ? 'JPEG' : 'PNG';
        // Logo centré, taille adaptée au format ticket (max 20mm de largeur)
        const logoWidth = 20;
        const logoHeight = 20;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(dataUrl, format, logoX, y, logoWidth, logoHeight);
        y += logoHeight + 2;
      }
    } catch (error) {
      console.error('Erreur chargement logo pour ticket PDF:', error);
      // Continuer sans logo
    }
  }

  // ===== EN-TÊTE =====
  const displayName = (ticketData.companyName || ticketData.establishmentName).toUpperCase();
  text(displayName, pageWidth / 2, y, 11, true, 'center');
  y += 4;

  if (ticketData.fullAddress) {
    text(ticketData.fullAddress, pageWidth / 2, y, 9, false, 'center');
    y += 3;
  }

  const phone = ticketData.businessPhone || '';
  if (phone) {
    text(phone, pageWidth / 2, y, 9, false, 'center');
    y += 3;
  }

  separator(y);
  y += 3;

  // RCCM et NIF
  if (ticketData.rcsNumber || ticketData.nifNumber) {
    if (ticketData.rcsNumber) {
      text(`RCCM : ${ticketData.rcsNumber}`, margin, y, 9, false);
      y += 3;
    }
    if (ticketData.nifNumber) {
      text(`NIF  : ${ticketData.nifNumber}`, margin, y, 9, false);
      y += 3;
    }
    separator(y);
    y += 3;
  }

  // ===== RÉFÉRENCES DU TICKET =====
  const date = new Date(ticketData.createdAt);
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  text(`Date : ${dateStr}`, margin, y, 9, false);
  y += 3;
  text(`Heure: ${timeStr}`, margin, y, 9, false);
  y += 3;

  if (ticketData.tableZone && ticketData.tableZone !== 'Caisse') {
    text(`Table: ${ticketData.tableZone.toUpperCase()}`, margin, y, 9, false);
    y += 3;
  }

  text(`Ticket: ${ticketData.orderNumber}`, margin, y, 9, false);
  y += 3;

  separator(y);
  y += 3;

  // ===== EN-TÊTE PRODUITS =====
  text('ARTICLE', margin, y, 9, true);
  text('QTE', margin + 42, y, 9, true);
  text('PRIX', pageWidth - margin, y, 9, true, 'right');
  y += 3;

  separator(y);
  y += 3;

  // ===== LISTE DES PRODUITS =====
  ticketData.items.forEach((item) => {
    const itemTotal = Math.round(Number(item.price) * Number(item.quantity));
    // Formatage simple sans séparateurs : 3000 au lieu de 3,000
    const priceText = itemTotal.toString();
    
    // Tronquer le nom si nécessaire (max 25 caractères)
    let productName = item.name || 'Produit';
    if (productName.length > 25) {
      productName = productName.substring(0, 22) + '...';
    }
    
    // Alignement en colonnes
    text(productName, margin, y, 9, false);
    text(item.quantity.toString(), margin + 42, y, 9, false);
    text(priceText, pageWidth - margin, y, 9, false, 'right');
    
    y += 3;
  });

  separator(y);
  y += 3;

  // ===== TOTAL =====
  const totalValue = Math.round(ticketData.total);
  // Formatage simple sans séparateurs : 3000 au lieu de 3,000
  const totalText = totalValue.toString();
  text('TOTAL', margin, y, 9, true);
  text(totalText, pageWidth - margin, y, 9, true, 'right');
  y += 3;

  separator(y);
  y += 3;

  // ===== PIED DE PAGE =====
  const customMsg = ticketData.ticketFooterMessage || ticketData.customMessage || 'MERCI ❤️';
  text(customMsg, pageWidth / 2, y, 9, false, 'center');
  y += 3;
  text('Powered by NACK!', pageWidth / 2, y, 8, false, 'center');
  y += 3;

  if (ticketData.showDeliveryMention) {
    separator(y);
    y += 3;
    text('LIVRAISON A DOMICILE', pageWidth / 2, y, 9, false, 'center');
    y += 3;
  }

  if (ticketData.showCSSMention) {
    const cssPercent = ticketData.cssPercentage || 1;
    text(`C.S.S. ${cssPercent}%`, pageWidth / 2, y, 9, false, 'center');
    y += 3;
  }

  separator(y);

  // Sauvegarder
  const fileName = `ticket-${ticketData.orderNumber}.pdf`;
  doc.save(fileName);
};

// Fonction pour générer un ticket simple (sans QR Code)
export const generateSimpleTicketPDF = async (ticketData: Omit<TicketData, 'receiptData'>): Promise<void> => {
  return generateTicketPDF(ticketData);
};
