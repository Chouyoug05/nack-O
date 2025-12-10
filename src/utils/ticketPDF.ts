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
  ticketLogoUrl?: string; // Logo noir et blanc pour tickets
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
}

// Couleurs pour ticket simple
const BLACK = [0, 0, 0];
const GRAY = [100, 100, 100];
const WHITE = [255, 255, 255];

/**
 * Convertit une image en noir et blanc
 */
async function convertToBlackAndWhite(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convertir en niveaux de gris puis en noir et blanc
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const bw = gray > 128 ? 255 : 0;
        data[i] = bw;     // R
        data[i + 1] = bw; // G
        data[i + 2] = bw; // B
        // data[i + 3] reste alpha
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

export const generateTicketPDF = async (ticketData: TicketData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [58, 200] // Format ticket 58mm (standard imprimantes thermiques)
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 3;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;

  // Fonction helper pour texte
  const text = (
    text: string,
    x: number,
    yPos: number,
    size: number = 9,
    bold: boolean = false,
    color: number[] = BLACK,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    
    let xPos = x;
    if (align === 'center') {
      const textWidth = doc.getTextWidth(text);
      xPos = (pageWidth - textWidth) / 2;
    } else if (align === 'right') {
      const textWidth = doc.getTextWidth(text);
      xPos = pageWidth - margin - textWidth;
    }
    
    doc.text(text, xPos, yPos);
  };

  // Fonction pour ligne
  const line = (yPos: number, width: number = 0.2) => {
    doc.setLineWidth(width);
    doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ===== EN-TÊTE =====
  // Logo établissement en noir et blanc (si disponible)
  const logoUrl = ticketData.ticketLogoUrl || ticketData.establishmentLogo;
  if (logoUrl) {
    try {
      let logoDataUrl = logoUrl;
      // Convertir en noir et blanc si ce n'est pas déjà fait
      if (!ticketData.ticketLogoUrl) {
        try {
          logoDataUrl = await convertToBlackAndWhite(logoUrl);
        } catch {
          // Si la conversion échoue, utiliser l'image originale
          logoDataUrl = logoUrl;
        }
      }
      
      const logoSize = 20; // Taille réduite
      const logoX = (pageWidth - logoSize) / 2;
      doc.addImage(logoDataUrl, 'PNG', logoX, y, logoSize, logoSize * 0.75);
      y += logoSize * 0.75 + 3;
    } catch (error) {
      // Ignorer l'erreur et continuer
    }
  }

  // Nom de l'établissement en MAJUSCULES
  const displayName = (ticketData.companyName || ticketData.establishmentName).toUpperCase();
  text(displayName, pageWidth / 2, y, 10, true, BLACK, 'center');
  y += 5;

  // Adresse
  if (ticketData.fullAddress) {
    text(ticketData.fullAddress, pageWidth / 2, y, 7, false, BLACK, 'center');
    y += 4;
  }

  // Contacts (téléphones)
  const phone = ticketData.businessPhone || '';
  if (phone) {
    text(phone, pageWidth / 2, y, 7, false, BLACK, 'center');
    y += 4;
  }

  // RCCM (format: RCCM:RG.LBV2016A40301)
  if (ticketData.rcsNumber) {
    text(`RCCM:${ticketData.rcsNumber}`, pageWidth / 2, y, 7, false, BLACK, 'center');
    y += 4;
  }

  // NIF (format: NIF:257208B)
  if (ticketData.nifNumber) {
    text(`NIF:${ticketData.nifNumber}`, pageWidth / 2, y, 7, false, BLACK, 'center');
    y += 4;
  }

  // "Powered by NACK!"
  y += 2;
  text('Powered by NACK!', pageWidth / 2, y, 6, false, GRAY, 'center');
  y += 5;

  line(y);
  y += 4;

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

  // Date
  text(dateStr, margin, y, 8, false, BLACK);
  y += 4;

  // Heure
  text(timeStr, margin, y, 8, false, BLACK);
  y += 4;

  // Table (si applicable)
  if (ticketData.tableZone && ticketData.tableZone !== 'Caisse') {
    text(`TABLE ${ticketData.tableZone.toUpperCase()}`, margin, y, 8, false, BLACK);
    y += 4;
  }

  // Numéro de ticket
  text(`Aucun ticket: ${ticketData.orderNumber}`, margin, y, 8, false, BLACK);
  y += 5;

  line(y);
  y += 4;

  // ===== LISTE DES PRODUITS =====
  ticketData.items.forEach((item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    const priceText = itemTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Format: "- 1 Produit .......... 1000,00"
    const leftText = `- ${item.quantity} ${item.name}`;
    
    // Calculer l'espace disponible et ajouter des points
    const leftWidth = doc.getTextWidth(leftText);
    const priceWidth = doc.getTextWidth(priceText);
    const availableWidth = contentWidth - leftWidth - priceWidth - 2;
    
    // Générer les points pour remplir l'espace
    const dotChar = '.';
    const dotWidth = doc.getTextWidth(dotChar);
    const numDots = Math.max(1, Math.floor(availableWidth / dotWidth));
    const dots = dotChar.repeat(numDots);
    
    // Ajuster le nom du produit si trop long
    let displayLeftText = leftText;
    if (leftWidth + priceWidth + (dotWidth * 3) > contentWidth) {
      // Tronquer le nom du produit
      const maxNameLength = Math.max(5, Math.floor((contentWidth - doc.getTextWidth(`- ${item.quantity} `) - priceWidth - (dotWidth * 5)) / (doc.getTextWidth('A'))));
      const truncatedName = item.name.length > maxNameLength ? item.name.substring(0, maxNameLength - 3) + '...' : item.name;
      displayLeftText = `- ${item.quantity} ${truncatedName}`;
    }
    
    // Afficher la ligne complète
    const fullLine = `${displayLeftText} ${dots} ${priceText}`;
    text(fullLine, margin, y, 8, false, BLACK);
    y += 4;
  });

  y += 2;
  line(y);
  y += 4;

  // ===== TOTAL =====
  text('Total des', margin, y, 9, false, BLACK);
  const totalValue = Math.round(ticketData.total * 100) / 100;
  const totalText = totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  text(totalText, pageWidth - margin, y, 10, true, BLACK, 'right');
  y += 6;

  // ===== MENTIONS DE FIN =====
  // THANK YOU (toujours affiché)
  text('THANK YOU', pageWidth / 2, y, 9, true, BLACK, 'center');
  y += 5;

  // LIVRAISON A DOMICILE (si activé)
  if (ticketData.showDeliveryMention) {
    text('LIVRAISON A DOMICILE', pageWidth / 2, y, 8, false, BLACK, 'center');
    y += 4;
  }

  // C.S.S. X% (si activé)
  if (ticketData.showCSSMention) {
    const cssPercent = ticketData.cssPercentage || 1;
    text(`C.S.S. ${cssPercent}%`, pageWidth / 2, y, 8, false, BLACK, 'center');
    y += 4;
  }

  // Message personnalisé (si défini)
  if (ticketData.ticketFooterMessage) {
    y += 2;
    text(ticketData.ticketFooterMessage, pageWidth / 2, y, 7, false, BLACK, 'center');
  }

  // Sauvegarder
  const fileName = `ticket-${ticketData.orderNumber}.pdf`;
  doc.save(fileName);
};

// Fonction pour générer un ticket simple (sans QR Code)
export const generateSimpleTicketPDF = async (ticketData: Omit<TicketData, 'receiptData'>): Promise<void> => {
  return generateTicketPDF(ticketData);
};
