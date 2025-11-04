/**
 * Génération de ticket thermique 58mm pour imprimantes ESC/POS
 * Format HTML/CSS minimal compatible avec les imprimantes thermiques
 */

export interface ThermalTicketData {
  orderNumber: string;
  establishmentName: string;
  tableZone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  createdAt: number;
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
  const productsRows = data.items.map(item => {
    const itemTotal = item.price * item.quantity;
    // Nom max 16 caractères pour laisser de la place aux colonnes
    const name = item.name.length > 16 ? item.name.substring(0, 13) + '...' : item.name;
    const namePadded = name.padEnd(16);
    const qte = item.quantity.toString().padStart(3);
    const price = itemTotal.toLocaleString('fr-FR').padStart(10);
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
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.2;
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;
      padding: 5mm;
      background: white;
      color: black;
    }
    
    .ticket {
      width: 100%;
      text-align: center;
    }
    
    .header {
      margin-bottom: 8px;
    }
    
    .header h1 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
    
    .separator {
      border-top: 1px dashed #000;
      margin: 8px 0;
      width: 100%;
    }
    
    .info-line {
      font-size: 10px;
      margin: 4px 0;
      text-align: left;
    }
    
    .info-line strong {
      font-weight: bold;
    }
    
    .products-header {
      font-weight: bold;
      font-size: 11px;
      margin: 8px 0 4px 0;
      text-align: left;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      font-family: 'Courier New', monospace;
      white-space: pre;
    }
    
    .products {
      text-align: left;
      font-size: 10px;
      margin: 4px 0;
      line-height: 1.4;
      font-family: 'Courier New', monospace;
      white-space: pre;
    }
    
    .total-line {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px dashed #000;
      font-weight: bold;
      font-size: 12px;
      text-align: left;
      font-family: 'Courier New', monospace;
      white-space: pre;
    }
    
    .footer {
      margin-top: 12px;
      font-size: 10px;
      text-align: center;
      font-style: italic;
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
    
    <div class="separator"></div>
    
    <div class="info-line">
      <strong>Nom du commerce :</strong> ${data.establishmentName}
    </div>
    <div class="info-line">
      <strong>Date :</strong> ${dateStr}  ${timeStr}
    </div>
    
    <div class="separator"></div>
    
    <div class="products-header">
PRODUIT          QTE      PRIX
    </div>
    
    <div class="products">
${productsRows}
    </div>
    
    <div class="separator"></div>
    
    <div class="total-line">
TOTAL              ${totalFormatted.padStart(10)} FCFA
    </div>
    
    <div class="separator"></div>
    
    <div class="footer">
Merci pour votre achat !
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

