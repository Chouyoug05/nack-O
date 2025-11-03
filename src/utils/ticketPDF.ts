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
}

// Couleurs modernes
const PRIMARY_COLOR = [220, 38, 38]; // Rouge NACK
const SECONDARY_COLOR = [252, 248, 227]; // Beige clair
const DARK_TEXT = [30, 30, 30];
const LIGHT_TEXT = [120, 120, 120];
const WHITE = [255, 255, 255];
const SUCCESS_COLOR = [34, 197, 94];

export const generateTicketPDF = async (ticketData: TicketData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 160] // Format ticket allongé pour plus d'espace
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 4;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;

  // Fonction helper pour texte
  const text = (
    text: string,
    x: number,
    yPos: number,
    size: number = 10,
    bold: boolean = false,
    color: number[] = DARK_TEXT,
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

  // Fonction pour ligne décorative
  const line = (yPos: number, color: number[] = [200, 200, 200], width: number = 0.2) => {
    doc.setLineWidth(width);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ===== EN-TÊTE ÉLÉGANT =====
  // Barre supérieure décorative
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  y = 8;

  // Logo NACK stylisé
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.circle(pageWidth / 2, y + 5, 6, 'F');
  text('N', pageWidth / 2, y + 7, 10, true, WHITE, 'center');
  
  y += 12;
  text('BAR CONNECTÉE', pageWidth / 2, y, 6, false, PRIMARY_COLOR, 'center');
  
  y += 4;
  line(y, [240, 240, 240], 0.3);
  y += 5;

  // Logo établissement si disponible
  if (ticketData.establishmentLogo) {
    try {
      doc.addImage(ticketData.establishmentLogo, 'PNG', (pageWidth - 25) / 2, y, 25, 18);
      y += 21;
    } catch (error) {
      console.warn('Erreur logo:', error);
    }
  }

  // Nom établissement avec style
  text(ticketData.establishmentName.toUpperCase(), pageWidth / 2, y, 11, true, DARK_TEXT, 'center');
  y += 6;
  line(y, [240, 240, 240], 0.3);
  y += 6;

  // ===== INFORMATIONS COMMANDE =====
  // Badge numéro de commande moderne
  const orderY = y;
  doc.setFillColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
  doc.rect(margin + 8, orderY - 2, contentWidth - 16, 7, 'F');
  
  text('COMMANDE', pageWidth / 2, orderY + 1, 6, false, LIGHT_TEXT, 'center');
  text(`#${ticketData.orderNumber}`, pageWidth / 2, orderY + 4, 10, true, PRIMARY_COLOR, 'center');
  y = orderY + 8;

  // Table et date avec icônes visuelles
  y += 3;
  text('📍', margin + 2, y, 8);
  text(`Table: ${ticketData.tableZone}`, margin + 8, y, 8, false, DARK_TEXT);
  
  y += 4;
  const dateStr = new Date(ticketData.createdAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  text('🕐', margin + 2, y, 8);
  text(dateStr, margin + 8, y, 8, false, LIGHT_TEXT);
  
  y += 6;
  line(y, [230, 230, 230], 0.2);
  y += 4;

  // ===== ARTICLES - TABLEAU MODERNE =====
  text('VOTRE COMMANDE', pageWidth / 2, y, 9, true, DARK_TEXT, 'center');
  y += 5;

  // En-tête du tableau
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 3, contentWidth, 4, 'F');
  text('Article', margin + 2, y, 7, true, DARK_TEXT);
  text('Qté', pageWidth / 2 - 8, y, 7, true, DARK_TEXT, 'center');
  text('Prix', pageWidth - margin - 2, y, 7, true, DARK_TEXT, 'right');
  y += 5;

  // Liste des articles avec style alterné
  ticketData.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    
    if (isEven) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 3, contentWidth, 5, 'F');
    }

    // Nom produit
    const maxLength = 20;
    const itemName = item.name.length > maxLength 
      ? item.name.substring(0, maxLength - 3) + '...' 
      : item.name;
    text(itemName, margin + 1, y, 8, false, DARK_TEXT);

    // Quantité
    text(`${item.quantity}`, pageWidth / 2, y, 8, false, LIGHT_TEXT, 'center');

    // Prix
    const itemTotal = item.price * item.quantity;
    const priceText = `${itemTotal.toLocaleString('fr-FR')} XAF`;
    text(priceText, pageWidth - margin - 1, y, 8, true, DARK_TEXT, 'right');
    
    y += 5;
  });

  y += 2;
  line(y, [200, 200, 200], 0.5);
  y += 4;

  // ===== TOTAL - HIGHLIGHT =====
  // Badge total moderne
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(margin + 2, y, contentWidth - 4, 9, 'F');
  
  text('TOTAL À PAYER', margin + 4, y + 4, 8, true, WHITE);
  const totalText = `${ticketData.total.toLocaleString('fr-FR')} XAF`;
  text(totalText, pageWidth - margin - 4, y + 4, 10, true, WHITE, 'right');
  
  y += 11;

  // ===== QR CODE =====
  if (ticketData.receiptData) {
    y += 3;
    text('VALIDATION', pageWidth / 2, y, 7, true, SUCCESS_COLOR, 'center');
    y += 5;
    
    try {
      const qrCodeData = JSON.stringify(ticketData.receiptData);
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
        width: 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      // Cadre moderne pour QR Code
      const qrSize = 35;
      const qrX = (pageWidth - qrSize) / 2;
      
      // Fond blanc avec ombre
      doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
      doc.rect(qrX - 2, y - 2, qrSize + 4, qrSize + 4, 'F');
      
      // Bordure fine
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.rect(qrX - 2, y - 2, qrSize + 4, qrSize + 4);
      
      // QR Code
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, qrSize, qrSize);
      y += qrSize + 5;
      
      text('Scanner pour valider', pageWidth / 2, y, 6, false, SUCCESS_COLOR, 'center');
      y += 4;
    } catch (error) {
      console.warn('Erreur QR Code:', error);
    }
  }

  y += 3;
  line(y, [240, 240, 240], 0.2);
  y += 4;

  // ===== PIED DE PAGE ÉLÉGANT =====
  text('Merci pour votre confiance !', pageWidth / 2, y, 8, true, PRIMARY_COLOR, 'center');
  y += 4;
  text('NACK.PRO', pageWidth / 2, y, 7, false, LIGHT_TEXT, 'center');
  
  // Barre inférieure décorative
  y += 4;
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(0, y, pageWidth, 2, 'F');
  
  text('www.nack.pro', pageWidth / 2, y + 1.5, 5, false, WHITE, 'center');

  // Sauvegarder
  const fileName = `ticket-${ticketData.orderNumber}.pdf`;
  doc.save(fileName);
};

// Fonction pour générer un ticket simple (sans QR Code)
export const generateSimpleTicketPDF = async (ticketData: Omit<TicketData, 'receiptData'>): Promise<void> => {
  return generateTicketPDF(ticketData);
};
