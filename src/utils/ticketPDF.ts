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

// Logo de la plateforme NACK (base64)
const NACK_LOGO_BASE64 = `data:image/svg+xml;base64,${btoa(`
<svg width="100" height="40" viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="40" fill="#1a1a1a" rx="4"/>
  <text x="50" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">NACK</text>
</svg>
`)}`;

export const generateTicketPDF = async (ticketData: TicketData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 120] // Format ticket standard
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5;
  const contentWidth = pageWidth - (margin * 2);

  let yPosition = margin;

  // Fonction pour ajouter du texte avec gestion de la largeur
  const addText = (text: string, fontSize: number, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const textWidth = doc.getTextWidth(text);
    let xPosition = margin;
    
    if (align === 'center') {
      xPosition = (pageWidth - textWidth) / 2;
    } else if (align === 'right') {
      xPosition = pageWidth - margin - textWidth;
    }
    
    doc.text(text, xPosition, yPosition);
    yPosition += fontSize * 0.5;
  };

  // Fonction pour ajouter une ligne
  const addLine = () => {
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 2;
  };

  // Fonction pour ajouter une image
  const addImage = async (imageData: string, width: number, height: number) => {
    try {
      doc.addImage(imageData, 'PNG', (pageWidth - width) / 2, yPosition, width, height);
      yPosition += height + 2;
    } catch (error) {
      console.warn('Erreur ajout image:', error);
    }
  };

  // En-tête avec logos
  try {
    // Logo NACK (plateforme)
    await addImage(NACK_LOGO_BASE64, 20, 8);
    yPosition += 2;
  } catch (error) {
    console.warn('Erreur logo NACK:', error);
  }

  addText('TICKET DE COMMANDE', 12, true, 'center');
  yPosition += 3;

  // Logo de l'établissement si disponible
  if (ticketData.establishmentLogo) {
    try {
      await addImage(ticketData.establishmentLogo, 25, 15);
      yPosition += 2;
    } catch (error) {
      console.warn('Erreur logo établissement:', error);
    }
  }

  addText(ticketData.establishmentName, 10, true, 'center');
  yPosition += 3;

  addLine();

  // Informations de la commande
  addText(`Commande: #${ticketData.orderNumber}`, 9, true);
  addText(`Table/Zone: ${ticketData.tableZone}`, 8);
  addText(`Date: ${new Date(ticketData.createdAt).toLocaleString('fr-FR')}`, 8);
  yPosition += 2;

  addLine();

  // Articles commandés
  addText('ARTICLES COMMANDÉS', 9, true, 'center');
  yPosition += 2;

  ticketData.items.forEach((item) => {
    const itemText = `${item.name} x${item.quantity}`;
    const priceText = `${(item.price * item.quantity).toLocaleString('fr-FR', { useGrouping: false })} XAF`;
    
    addText(itemText, 8);
    
    // Prix aligné à droite
    doc.setFontSize(8);
    const priceWidth = doc.getTextWidth(priceText);
    doc.text(priceText, pageWidth - margin - priceWidth, yPosition - 4);
    
    yPosition += 1;
  });

  yPosition += 2;
  addLine();

  // Total
  const totalText = `TOTAL: ${ticketData.total.toLocaleString('fr-FR', { useGrouping: false })} XAF`;
  addText(totalText, 10, true, 'center');
  yPosition += 3;

  // QR Code du reçu
  if (ticketData.receiptData) {
    try {
      const qrCodeData = JSON.stringify(ticketData.receiptData);
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
        width: 60,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      await addImage(qrCodeDataUrl, 20, 20);
      addText('Scanner pour validation', 6, false, 'center');
    } catch (error) {
      console.warn('Erreur génération QR Code:', error);
    }
  }

  yPosition += 3;

  // Pied de page
  addLine();
  addText('Merci pour votre commande !', 8, false, 'center');
  addText('NACK.PRO - Bar Connectée', 6, false, 'center');

  // Sauvegarder le PDF
  const fileName = `ticket-${ticketData.orderNumber}.pdf`;
  doc.save(fileName);
};

// Fonction pour générer un ticket simple (sans QR Code)
export const generateSimpleTicketPDF = async (ticketData: Omit<TicketData, 'receiptData'>): Promise<void> => {
  return generateTicketPDF(ticketData);
};
