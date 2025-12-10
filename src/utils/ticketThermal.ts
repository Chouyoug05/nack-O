/**
 * Génération de ticket thermique 58mm pour imprimantes ESC/POS
 * Format HTML/CSS minimal compatible avec les imprimantes thermiques
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

  // Formatage des produits avec alignement (ticket 58mm = ~32 caractères)
  // Format: PRODUIT            QTE    PRIX
  //         Biere Castel        2    2 000
  const productsRows = data.items.map(item => {
    const itemTotal = item.price * item.quantity;
    // Nom max 18 caractères pour correspondre au format demandé
    const name = item.name.length > 18 ? item.name.substring(0, 15) + '...' : item.name;
    const namePadded = name.padEnd(18);
    const qte = item.quantity.toString().padStart(3);
    const price = itemTotal.toLocaleString('fr-FR').padStart(8);
    return `${namePadded} ${qte} ${price}`;
  }).join('\n');

  const totalFormatted = data.total.toLocaleString('fr-FR');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket NACK - ${data.orderNumber}</title>
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;
      padding: 4mm;
      background: white;
      color: #1a1a1a;
    }
    
    .ticket {
      width: 100%;
    }
    
    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #dc2626;
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 4px 0;
      letter-spacing: 2px;
      color: #dc2626;
    }
    
    .logo-section {
      text-align: center;
      margin: 8px 0;
    }
    
    .logo-section img {
      max-width: 40px;
      max-height: 40px;
      margin-bottom: 4px;
    }
    
    .company-name {
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      margin: 6px 0;
      color: #1a1a1a;
    }
    
    .company-info {
      font-size: 9px;
      text-align: center;
      margin: 2px 0;
      color: #666;
      line-height: 1.3;
    }
    
    .separator {
      border-top: 1px dashed #ccc;
      margin: 8px 0;
      width: 100%;
    }
    
    .separator-thick {
      border-top: 2px solid #dc2626;
      margin: 10px 0;
      width: 100%;
    }
    
    .order-info {
      text-align: center;
      margin: 8px 0;
      padding: 6px;
      background: #fef2f2;
      border-radius: 4px;
    }
    
    .order-number {
      font-size: 14px;
      font-weight: 700;
      color: #dc2626;
      margin-bottom: 4px;
    }
    
    .order-date {
      font-size: 9px;
      color: #666;
    }
    
    .table-info {
      font-size: 10px;
      color: #666;
      margin-top: 4px;
    }
    
    .products-header {
      font-weight: 700;
      font-size: 10px;
      margin: 8px 0 4px 0;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 4px;
      color: #1a1a1a;
    }
    
    .products {
      text-align: left;
      font-size: 10px;
      margin: 4px 0;
      line-height: 1.5;
    }
    
    .product-item {
      margin: 6px 0;
      padding: 4px 0;
      border-bottom: 1px dotted #e5e5e5;
    }
    
    .product-name {
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    .product-details {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #666;
    }
    
    .total-line {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 2px solid #dc2626;
      text-align: right;
    }
    
    .total-label {
      font-size: 11px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    
    .total-amount {
      font-size: 16px;
      font-weight: 700;
      color: #dc2626;
    }
    
    .legal-mentions {
      font-size: 8px;
      color: #999;
      text-align: center;
      margin: 8px 0;
      line-height: 1.3;
      font-style: italic;
    }
    
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #ccc;
      font-size: 10px;
      text-align: center;
      color: #dc2626;
      font-weight: 500;
    }
    
    .print-button {
      display: block;
      width: 100%;
      padding: 12px;
      margin: 20px auto;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      text-align: center;
    }
    
    .print-button:hover {
      background: #b91c1c;
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
    <div class="header">
      <h1>NACK!</h1>
    </div>
    
    ${data.establishmentLogo ? `
    <div class="logo-section">
      <img src="${data.establishmentLogo}" alt="Logo" />
    </div>
    ` : ''}
    
    <div class="company-name">${data.companyName || data.establishmentName}</div>
    
    ${data.fullAddress ? `<div class="company-info">${data.fullAddress}</div>` : ''}
    ${data.businessPhone ? `<div class="company-info">📞 ${data.businessPhone}</div>` : ''}
    ${data.rcsNumber ? `<div class="company-info">RCS: ${data.rcsNumber}</div>` : ''}
    ${data.nifNumber ? `<div class="company-info">NIF: ${data.nifNumber}</div>` : ''}
    
    <div class="separator-thick"></div>
    
    <div class="order-info">
      <div class="order-number">COMMANDE #${data.orderNumber}</div>
      <div class="order-date">${dateStr} à ${timeStr}</div>
      ${data.tableZone ? `<div class="table-info">Table: ${data.tableZone}</div>` : ''}
    </div>
    
    <div class="separator"></div>
    
    <div class="products-header">
      PRODUITS
    </div>
    
    <div class="products">
      ${data.items.map(item => {
        const itemTotal = item.price * item.quantity;
        return `
        <div class="product-item">
          <div class="product-name">${item.name}</div>
          <div class="product-details">
            <span>${item.quantity} x ${item.price.toLocaleString('fr-FR')} XAF</span>
            <span style="font-weight: 600;">${itemTotal.toLocaleString('fr-FR')} XAF</span>
          </div>
        </div>
        `;
      }).join('')}
    </div>
    
    <div class="separator-thick"></div>
    
    <div class="total-line">
      <div class="total-label">TOTAL À PAYER</div>
      <div class="total-amount">${totalFormatted} XAF</div>
    </div>
    
    ${data.legalMentions ? `
    <div class="separator"></div>
    <div class="legal-mentions">${data.legalMentions}</div>
    ` : ''}
    
    <div class="footer">
      ${data.customMessage || 'Merci pour votre confiance ! ❤️'}
    </div>
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
      // Fermer la fenêtre après impression (optionnel)
      // printWindow.close();
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

