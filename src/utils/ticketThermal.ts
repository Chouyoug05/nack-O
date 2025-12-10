/**
 * Génération de ticket thermique 58mm pour imprimantes ESC/POS
 * Format HTML/CSS minimal compatible avec les imprimantes thermiques
 * Design inspiré des tickets de restaurant gabonais
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
  ticketLogoUrl?: string; // Logo noir et blanc pour tickets
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
}

/**
 * Convertit une image en noir et blanc (pour le logo)
 */
function convertImageToBW(imageUrl: string): string {
  // Pour le HTML, on utilise un filtre CSS pour convertir en noir et blanc
  return imageUrl;
}

/**
 * Génère le HTML du ticket thermique
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

  // Formatage des produits : "- 1 Produit .......... 1000,00"
  // Largeur ticket 58mm = ~32 caractères en police 8px
  const MAX_LINE_LENGTH = 32;
  const productsRows = data.items.map(item => {
    const itemTotal = item.price * item.quantity;
    const priceText = itemTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Tronquer le nom du produit si nécessaire
    const prefix = `- ${item.quantity} `;
    const maxNameLength = MAX_LINE_LENGTH - prefix.length - priceText.length - 5; // 5 pour les points
    let productName = item.name;
    if (productName.length > maxNameLength) {
      productName = productName.substring(0, maxNameLength - 3) + '...';
    }
    
    // Construire la ligne complète
    const leftPart = `${prefix}${productName}`;
    const availableWidth = MAX_LINE_LENGTH - leftPart.length - priceText.length;
    const dots = availableWidth > 0 ? '.'.repeat(Math.max(3, availableWidth)) : '...';
    
    return `${leftPart}${dots}${priceText}`;
  }).join('\n');

  const totalFormatted = data.total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayName = (data.companyName || data.establishmentName).toUpperCase();
  const logoUrl = data.ticketLogoUrl || data.establishmentLogo;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket - ${data.orderNumber}</title>
  <style>
    @page {
      size: 58mm auto;
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
      font-family: 'Courier New', monospace;
      font-size: 9px;
      line-height: 1.3;
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;
      padding: 3mm;
      background: white;
      color: #000;
      overflow-x: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .ticket {
      width: 100%;
      max-width: 100%;
      text-align: center;
      overflow-x: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .logo-container {
      text-align: center;
      margin-bottom: 5px;
    }
    
    .logo-container img {
      max-width: 25mm;
      max-height: 20mm;
      filter: grayscale(100%) contrast(1.2);
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    
    .company-name {
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      margin: 4px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }
    
    .company-info {
      font-size: 8px;
      text-align: center;
      margin: 2px 0;
      line-height: 1.2;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }
    
    .powered-by {
      font-size: 7px;
      text-align: center;
      margin: 3px 0;
      color: #666;
    }
    
    .separator {
      border-top: 1px solid #000;
      margin: 5px 0;
      width: 100%;
    }
    
    .ticket-info {
      text-align: left;
      font-size: 8px;
      margin: 4px 0;
      line-height: 1.4;
    }
    
    .products-section {
      text-align: left;
      margin: 5px 0;
      font-family: 'Courier New', monospace;
      font-size: 8px;
      line-height: 1.4;
      white-space: pre;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }
    
    .total-section {
      margin-top: 5px;
      padding-top: 3px;
      border-top: 1px solid #000;
      text-align: left;
    }
    
    .total-label {
      font-size: 9px;
      font-weight: bold;
    }
    
    .total-amount {
      font-size: 10px;
      font-weight: bold;
      text-align: right;
      margin-top: 2px;
    }
    
    .footer-mentions {
      text-align: center;
      margin-top: 6px;
      font-size: 9px;
      font-weight: bold;
      line-height: 1.5;
    }
    
    .footer-message {
      text-align: center;
      margin-top: 4px;
      font-size: 8px;
      color: #333;
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
    <!-- Logo en noir et blanc -->
    ${logoUrl ? `
    <div class="logo-container">
      <img src="${logoUrl}" alt="Logo" style="filter: grayscale(100%) contrast(1.5);" />
    </div>
    ` : ''}
    
    <!-- Nom de l'établissement en MAJUSCULES -->
    <div class="company-name">${displayName}</div>
    
    <!-- Adresse -->
    ${data.fullAddress ? `<div class="company-info">${data.fullAddress}</div>` : ''}
    
    <!-- Contacts -->
    ${data.businessPhone ? `<div class="company-info">${data.businessPhone}</div>` : ''}
    
    <!-- RCCM -->
    ${data.rcsNumber ? `<div class="company-info">RCCM:${data.rcsNumber}</div>` : ''}
    
    <!-- NIF -->
    ${data.nifNumber ? `<div class="company-info">NIF:${data.nifNumber}</div>` : ''}
    
    <!-- Powered by NACK! -->
    <div class="powered-by">Powered by NACK!</div>
    
    <div class="separator"></div>
    
    <!-- Références du ticket -->
    <div class="ticket-info">
      <div>${dateStr}</div>
      <div>${timeStr}</div>
      ${data.tableZone && data.tableZone !== 'Caisse' ? `<div>TABLE ${data.tableZone.toUpperCase()}</div>` : ''}
      <div>Aucun ticket: ${data.orderNumber}</div>
    </div>
    
    <div class="separator"></div>
    
    <!-- Liste des produits -->
    <div class="products-section">
${productsRows}
    </div>
    
    <div class="separator"></div>
    
    <!-- Total -->
    <div class="total-section">
      <div class="total-label">Total des</div>
      <div class="total-amount">${totalFormatted}</div>
    </div>
    
    <!-- Mentions de fin -->
    <div class="footer-mentions">
      <div>THANK YOU</div>
      ${data.showDeliveryMention ? '<div>LIVRAISON A DOMICILE</div>' : ''}
      ${data.showCSSMention ? `<div>C.S.S. ${data.cssPercentage || 1}%</div>` : ''}
    </div>
    
    <!-- Message personnalisé -->
    ${data.ticketFooterMessage ? `<div class="footer-message">${data.ticketFooterMessage}</div>` : ''}
  </div>
  
  <button class="print-button no-print" onclick="window.print()">
    🖨️ Imprimer
  </button>
  
  <script>
    // Auto-print option (peut être désactivé si nécessaire)
    // window.onload = function() {
    //   setTimeout(() => window.print(), 500);
    // };
  </script>
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
  const printWindow = window.open('', '_blank', 'width=58mm,height=auto');
  
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
