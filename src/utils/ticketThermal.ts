/**
 * Génération de ticket thermique 80mm pour imprimantes ESC/POS
 * Format HTML/CSS minimal compatible avec les imprimantes thermiques
 * Style ticket de caisse POS professionnel
 */

export interface ThermalTicketData {
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

/**
 * Génère le HTML du ticket thermique au format 80mm
 */
export function generateThermalTicketHTML(data: ThermalTicketData): string {
  const date = new Date(data.createdAt);
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const displayName = (data.companyName || data.establishmentName).toUpperCase();
  const address = data.fullAddress || '';
  const phone = data.businessPhone || '';
  const rcs = data.rcsNumber || '';
  const nif = data.nifNumber || '';
  const table = data.tableZone && data.tableZone !== 'Caisse' ? data.tableZone.toUpperCase() : '';
  const customMsg = data.ticketFooterMessage || data.customMessage || 'MERCI ❤️';

  // Formatage des produits en colonnes : ARTICLE, QTE, PRIX
  // Largeur ticket 80mm = ~48 caractères en police monospace 9px
  const MAX_LINE_LENGTH = 48;
  const SEPARATOR = '-'.repeat(MAX_LINE_LENGTH);
  
  const productsRows = data.items.map(item => {
    const itemTotal = Math.round(item.price * item.quantity);
    // Formatage simple sans séparateurs : 3000 au lieu de 3,000
    const priceText = itemTotal.toString();
    
    // Tronquer le nom si nécessaire (max 25 caractères)
    let productName = item.name;
    if (productName.length > 25) {
      productName = productName.substring(0, 22) + '...';
    }
    
    // Alignement en colonnes : ARTICLE (25) + QTE (5) + PRIX (10)
    const articleCol = productName.padEnd(25);
    const qteCol = item.quantity.toString().padStart(5);
    const prixCol = priceText.padStart(10);
    
    return `${articleCol}${qteCol}${prixCol}`;
  }).join('\n');

  // Formatage simple sans séparateurs : 3000 au lieu de 3,000
  const totalFormatted = Math.round(data.total).toString();
  const totalLine = `TOTAL${' '.repeat(21)}${totalFormatted.padStart(10)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket - ${data.orderNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .no-print {
        display: none !important;
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
      font-size: 9px;
      line-height: 1.2;
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 2mm;
      background: white;
      color: #000;
      overflow-x: hidden;
    }
    
    .ticket {
      width: 100%;
      max-width: 100%;
      background: white;
    }
    
    .separator {
      text-align: center;
      font-family: 'Courier New', monospace;
      font-size: 9px;
      margin: 2px 0;
      color: #000;
    }
    
    .header {
      text-align: center;
      margin: 3px 0;
    }
    
    .company-name {
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      margin: 2px 0;
      text-transform: uppercase;
      font-family: 'Courier New', monospace;
    }
    
    .company-info {
      font-size: 9px;
      text-align: center;
      margin: 1px 0;
      font-family: 'Courier New', monospace;
    }
    
    .info-section {
      font-size: 9px;
      text-align: left;
      margin: 2px 0;
      font-family: 'Courier New', monospace;
      line-height: 1.3;
    }
    
    .info-line {
      margin: 1px 0;
    }
    
    .products-header {
      font-size: 9px;
      text-align: left;
      margin: 2px 0;
      font-family: 'Courier New', monospace;
      font-weight: bold;
    }
    
    .products-section {
      font-size: 9px;
      text-align: left;
      margin: 2px 0;
      font-family: 'Courier New', monospace;
      white-space: pre;
      line-height: 1.3;
    }
    
    .total-section {
      font-size: 9px;
      text-align: left;
      margin: 2px 0;
      font-family: 'Courier New', monospace;
      font-weight: bold;
    }
    
    .footer {
      text-align: center;
      margin: 3px 0;
      font-family: 'Courier New', monospace;
    }
    
    .footer-message {
      font-size: 9px;
      margin: 2px 0;
    }
    
    .powered-by {
      font-size: 8px;
      margin: 2px 0;
      color: #000;
    }
    
    .print-button {
      display: block;
      width: 100%;
      padding: 10px;
      margin: 15px auto;
      background: #000;
      color: white;
      border: none;
      border-radius: 3px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    
    .print-button:hover {
      background: #333;
    }
    
    @media print {
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="separator">${SEPARATOR}</div>
    
    <div class="header">
      <div class="company-name">${displayName}</div>
      ${address ? `<div class="company-info">${address}</div>` : ''}
      ${phone ? `<div class="company-info">${phone}</div>` : ''}
    </div>
    
    <div class="separator">${SEPARATOR}</div>
    
    ${rcs || nif ? `
    <div class="info-section">
      ${rcs ? `<div class="info-line">RCCM : ${rcs}</div>` : ''}
      ${nif ? `<div class="info-line">NIF  : ${nif}</div>` : ''}
    </div>
    <div class="separator">${SEPARATOR}</div>
    ` : ''}
    
    <div class="info-section">
      <div class="info-line">Date : ${dateStr}</div>
      <div class="info-line">Heure: ${timeStr}</div>
      ${table ? `<div class="info-line">Table: ${table}</div>` : ''}
      <div class="info-line">Ticket: ${data.orderNumber}</div>
    </div>
    
    <div class="separator">${SEPARATOR}</div>
    
    <div class="products-header">ARTICLE${' '.repeat(17)}QTE${' '.repeat(2)}PRIX</div>
    
    <div class="separator">${SEPARATOR}</div>
    
    <div class="products-section">${productsRows}</div>
    
    <div class="separator">${SEPARATOR}</div>
    
    <div class="total-section">${totalLine}</div>
    
    <div class="separator">${SEPARATOR}</div>
    
    <div class="footer">
      <div class="footer-message">${customMsg}</div>
      <div class="powered-by">Powered by NACK!</div>
    </div>
    
    ${data.showDeliveryMention ? `
    <div class="separator">${SEPARATOR}</div>
    <div class="footer-message" style="text-align: center;">LIVRAISON A DOMICILE</div>
    ` : ''}
    
    ${data.showCSSMention ? `
    <div class="footer-message" style="text-align: center;">C.S.S. ${data.cssPercentage || 1}%</div>
    ` : ''}
    
    <div class="separator">${SEPARATOR}</div>
  </div>
  
  <button class="print-button no-print" onclick="window.print()">
    🖨️ Imprimer
  </button>
</body>
</html>
  `.trim();

  return html;
}

/**
 * Ouvre le ticket dans une nouvelle fenêtre et déclenche l'impression
 */
export function printThermalTicket(data: ThermalTicketData): void {
  const html = generateThermalTicketHTML(data);
  const printWindow = window.open('', '_blank', 'width=80mm,height=auto');
  
  if (!printWindow) {
    alert('Veuillez autoriser les popups pour imprimer le ticket.');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Attendre que le contenu soit chargé avant d'imprimer
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Télécharge le ticket au format HTML
 */
export function downloadThermalTicket(data: ThermalTicketData): void {
  const html = generateThermalTicketHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${data.orderNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
