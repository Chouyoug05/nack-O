import type { SaleDoc, LossDoc } from "@/types/inventory";
import jsPDF from "jspdf";

export interface ReportOrder {
  createdAt: number;
  total: number;
  tableNumber?: string;
  status?: string;
  agentName?: string;
  agentCode?: string;
}

export const exportSalesCsv = (opts: { sales: SaleDoc[]; losses: LossDoc[]; orders: ReportOrder[]; periodLabel: string; fileName?: string; }) => {
  const { sales, losses, orders, periodLabel, fileName } = opts;
  const rows: string[] = [];
  rows.push(`Rapport ${periodLabel}`);
  rows.push("");
  rows.push("Commandes");
  rows.push("date,total,table,statut,agent");
  for (const o of orders) {
    const date = new Date(o.createdAt).toISOString();
    const agent = o.agentName ? `${o.agentName}${o.agentCode ? ` (${o.agentCode})` : ''}` : (o.agentCode || "");
    rows.push(`${date},${o.total},${o.tableNumber || ''},${o.status || ''},"${agent}"`);
  }
  rows.push("");
  rows.push("Ventes");
  rows.push("date,total,paiement,details");
  for (const s of sales) {
    const date = new Date(s.createdAt).toISOString();
    const details = s.items.map(i => `${i.name} x${i.quantity}`).join(" | ");
    rows.push(`${date},${s.total},${s.paymentMethod},"${details}"`);
  }
  rows.push("");
  rows.push("Pertes");
  rows.push("date,article,quantite,cost");
  for (const l of losses) {
    const date = new Date(l.createdAt).toISOString();
    rows.push(`${date},${l.productName},${l.quantity},${l.cost}`);
  }
  const csv = rows.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `rapport-${periodLabel}.csv`;
  a.style.display = "none";
  try {
    document.body.appendChild(a);
    a.click();
  } finally {
    try {
      if (a && a.parentNode) {
        a.parentNode.removeChild(a);
      }
    } catch { /* ignore */ }
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
};

async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const exportSalesPdf = async (opts: { sales: SaleDoc[]; losses: LossDoc[]; orders: ReportOrder[]; periodLabel: string; summary: { ventes: number; commandes: number; pertes: number; benefice: number; }; org: { establishmentName: string; establishmentType?: string; ownerName?: string; email?: string; phone?: string; logoUrl?: string; }; fileName?: string; }) => {
  const { sales, losses, orders, periodLabel, summary, org, fileName } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;

  // Header avec logo et établissement
  if (org.logoUrl) {
    try {
      const dataUrl = await loadImageAsDataURL(org.logoUrl);
      doc.addImage(dataUrl, "PNG", 40, y - 10, 48, 48);
    } catch {
      void 0; // ignore logo load errors
    }
  }
  doc.setFontSize(18);
  doc.text(org.establishmentName || "Mon Établissement", 100, y + 10);
  doc.setFontSize(11);
  const orgLine2 = [org.establishmentType, org.ownerName].filter(Boolean).join(" • ");
  if (orgLine2) { y += 16; doc.text(orgLine2, 100, y + 10); }
  const contacts = [org.email, org.phone].filter(Boolean).join(" • ");
  if (contacts) { y += 16; doc.text(contacts, 100, y + 10); }

  // Titre du rapport
  y += 36;
  doc.setDrawColor(230); doc.setLineWidth(1); doc.line(40, y, 555, y); y += 20;
  doc.setFontSize(16);
  doc.text(`Rapport ${periodLabel}`, 40, y); y += 24;

  // Tableau de résumé
  const tableData = [
    { metric: "Ventes totales", value: `${summary.ventes.toLocaleString('fr-FR', { useGrouping: false })} XAF`, status: "Positif" },
    { metric: "Nombre de commandes", value: summary.commandes.toString(), status: "Actif" },
    { metric: "Pertes enregistrées", value: `${summary.pertes.toLocaleString('fr-FR', { useGrouping: false })} XAF`, status: "À surveiller" },
    { metric: "Bénéfice net", value: `${summary.benefice.toLocaleString('fr-FR', { useGrouping: false })} XAF`, status: "Excellent" }
  ];

  // Dessiner le tableau
  const tableStartY = y;
  const tableWidth = 515; // Largeur du tableau
  const rowHeight = 25;
  const col1Width = 200; // Métrique
  const col2Width = 150; // Valeur
  const col3Width = 165; // Statut

  // En-têtes du tableau
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(40, tableStartY, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(40, tableStartY, tableWidth, rowHeight);
  
  // Lignes verticales pour les colonnes
  doc.line(40 + col1Width, tableStartY, 40 + col1Width, tableStartY + rowHeight);
  doc.line(40 + col1Width + col2Width, tableStartY, 40 + col1Width + col2Width, tableStartY + rowHeight);
  
  // Texte des en-têtes
  doc.text("Métrique", 50, tableStartY + 16);
  doc.text("Valeur", 40 + col1Width + 10, tableStartY + 16);
  doc.text("Statut", 40 + col1Width + col2Width + 10, tableStartY + 16);

  // Données du tableau
  doc.setFont(undefined, 'normal');
  doc.setFillColor(255, 255, 255);
  
  tableData.forEach((row, index) => {
    const rowY = tableStartY + rowHeight + (index * rowHeight);
    
    // Fond alterné pour les lignes
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(40, rowY, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(40, rowY, tableWidth, rowHeight, 'F');
    }
    
    // Bordures du tableau
    doc.setDrawColor(200, 200, 200);
    doc.rect(40, rowY, tableWidth, rowHeight);
    doc.line(40 + col1Width, rowY, 40 + col1Width, rowY + rowHeight);
    doc.line(40 + col1Width + col2Width, rowY, 40 + col1Width + col2Width, rowY + rowHeight);
    
    // Texte des données
    doc.setFontSize(11);
    doc.text(row.metric, 50, rowY + 16);
    doc.text(row.value, 40 + col1Width + 10, rowY + 16);
    doc.text(row.status, 40 + col1Width + col2Width + 10, rowY + 16);
  });

  y = tableStartY + rowHeight + (tableData.length * rowHeight) + 30;

  // Commandes détaillées
  doc.setFontSize(14); doc.text("Détail des Commandes", 40, y); y += 18;
  
  if (orders.length === 0) {
    doc.setFontSize(11);
    doc.text("Aucune commande pour cette période", 40, y); y += 14;
  } else {
    // En-têtes du tableau des commandes
    const ordersTableStartY = y;
    const ordersTableWidth = 515;
    const ordersRowHeight = 20;
    const ordersCol1Width = 120; // Date
    const ordersCol2Width = 80;  // Table
    const ordersCol3Width = 100; // Agent
    const ordersCol4Width = 100; // Total
    const ordersCol5Width = 115; // Statut

    // En-têtes
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(40, ordersTableStartY, ordersTableWidth, ordersRowHeight, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(40, ordersTableStartY, ordersTableWidth, ordersRowHeight);
    
    // Lignes verticales
    doc.line(40 + ordersCol1Width, ordersTableStartY, 40 + ordersCol1Width, ordersTableStartY + ordersRowHeight);
    doc.line(40 + ordersCol1Width + ordersCol2Width, ordersTableStartY, 40 + ordersCol1Width + ordersCol2Width, ordersTableStartY + ordersRowHeight);
    doc.line(40 + ordersCol1Width + ordersCol2Width + ordersCol3Width, ordersTableStartY, 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width, ordersTableStartY + ordersRowHeight);
    doc.line(40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width, ordersTableStartY, 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width, ordersTableStartY + ordersRowHeight);
    
    // Texte des en-têtes
    doc.text("Date", 45, ordersTableStartY + 13);
    doc.text("Table", 40 + ordersCol1Width + 5, ordersTableStartY + 13);
    doc.text("Agent", 40 + ordersCol1Width + ordersCol2Width + 5, ordersTableStartY + 13);
    doc.text("Total", 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + 5, ordersTableStartY + 13);
    doc.text("Statut", 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width + 5, ordersTableStartY + 13);

    // Données des commandes
    doc.setFont(undefined, 'normal');
    orders.forEach((order, index) => {
      const rowY = ordersTableStartY + ordersRowHeight + (index * ordersRowHeight);
      
      // Vérifier si on dépasse la page
      if (rowY > 750) {
        doc.addPage();
        y = 40;
        return;
      }
      
      // Fond alterné
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(40, rowY, ordersTableWidth, ordersRowHeight, 'F');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(40, rowY, ordersTableWidth, ordersRowHeight, 'F');
      }
      
      // Bordures
      doc.setDrawColor(200, 200, 200);
      doc.rect(40, rowY, ordersTableWidth, ordersRowHeight);
      doc.line(40 + ordersCol1Width, rowY, 40 + ordersCol1Width, rowY + ordersRowHeight);
      doc.line(40 + ordersCol1Width + ordersCol2Width, rowY, 40 + ordersCol1Width + ordersCol2Width, rowY + ordersRowHeight);
      doc.line(40 + ordersCol1Width + ordersCol2Width + ordersCol3Width, rowY, 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width, rowY + ordersRowHeight);
      doc.line(40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width, rowY, 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width, rowY + ordersRowHeight);
      
      // Texte des données
      doc.setFontSize(9);
      const date = new Date(order.createdAt).toLocaleDateString();
      const agent = order.agentName ? `${order.agentName}${order.agentCode ? ` (${order.agentCode})` : ''}` : (order.agentCode || "");
      
      doc.text(date, 45, rowY + 13);
      doc.text(order.tableNumber || '-', 40 + ordersCol1Width + 5, rowY + 13);
      doc.text(agent || '-', 40 + ordersCol1Width + ordersCol2Width + 5, rowY + 13);
      doc.text(`${order.total.toLocaleString('fr-FR', { useGrouping: false })} XAF`, 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + 5, rowY + 13);
      doc.text(order.status || '-', 40 + ordersCol1Width + ordersCol2Width + ordersCol3Width + ordersCol4Width + 5, rowY + 13);
    });

    y = ordersTableStartY + ordersRowHeight + (orders.length * ordersRowHeight) + 20;
  }

  // Ventes détaillées (format reçu)
  doc.setFontSize(14); doc.text("Détail des Ventes", 40, y); y += 18;
  
  if (sales.length === 0) {
    doc.setFontSize(11);
    doc.text("Aucune vente pour cette période", 40, y); y += 14;
  } else {
    sales.forEach((sale, saleIndex) => {
      // Vérifier si on dépasse la page
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
      
      // En-tête du reçu
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Reçu #${saleIndex + 1}`, 40, y);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      
      const saleDate = new Date(sale.createdAt).toLocaleString('fr-FR');
      doc.text(`Date: ${saleDate}`, 40, y + 12);
      doc.text(`Méthode: ${sale.paymentMethod || 'Non spécifiée'}`, 40, y + 24);
      y += 40;
      
      // Tableau des produits
      const productsTableStartY = y;
      const productsTableWidth = 515;
      const productsRowHeight = 18;
      const productsCol1Width = 250; // Produit
      const productsCol2Width = 80;  // Quantité
      const productsCol3Width = 100; // Prix unitaire
      const productsCol4Width = 85; // Total

      // En-têtes du tableau des produits
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(40, productsTableStartY, productsTableWidth, productsRowHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(40, productsTableStartY, productsTableWidth, productsRowHeight);
      
      // Lignes verticales
      doc.line(40 + productsCol1Width, productsTableStartY, 40 + productsCol1Width, productsTableStartY + productsRowHeight);
      doc.line(40 + productsCol1Width + productsCol2Width, productsTableStartY, 40 + productsCol1Width + productsCol2Width, productsTableStartY + productsRowHeight);
      doc.line(40 + productsCol1Width + productsCol2Width + productsCol3Width, productsTableStartY, 40 + productsCol1Width + productsCol2Width + productsCol3Width, productsTableStartY + productsRowHeight);
      
      // Texte des en-têtes
      doc.text("Produit", 45, productsTableStartY + 12);
      doc.text("Qté", 40 + productsCol1Width + 5, productsTableStartY + 12);
      doc.text("Prix unit.", 40 + productsCol1Width + productsCol2Width + 5, productsTableStartY + 12);
      doc.text("Total", 40 + productsCol1Width + productsCol2Width + productsCol3Width + 5, productsTableStartY + 12);

      // Données des produits
      doc.setFont(undefined, 'normal');
      sale.items.forEach((item, itemIndex) => {
        const itemRowY = productsTableStartY + productsRowHeight + (itemIndex * productsRowHeight);
        
        // Fond alterné
        if (itemIndex % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(40, itemRowY, productsTableWidth, productsRowHeight, 'F');
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(40, itemRowY, productsTableWidth, productsRowHeight, 'F');
        }
        
        // Bordures
        doc.setDrawColor(200, 200, 200);
        doc.rect(40, itemRowY, productsTableWidth, productsRowHeight);
        doc.line(40 + productsCol1Width, itemRowY, 40 + productsCol1Width, itemRowY + productsRowHeight);
        doc.line(40 + productsCol1Width + productsCol2Width, itemRowY, 40 + productsCol1Width + productsCol2Width, itemRowY + productsRowHeight);
        doc.line(40 + productsCol1Width + productsCol2Width + productsCol3Width, itemRowY, 40 + productsCol1Width + productsCol2Width + productsCol3Width, itemRowY + productsRowHeight);
        
        // Texte des données
        doc.setFontSize(8);
        const unitPrice = Number(item.price || 0);
        const itemTotal = unitPrice * Number(item.quantity || 0);
        
        doc.text(item.name || 'Produit inconnu', 45, itemRowY + 11);
        doc.text(`${item.quantity || 0}`, 40 + productsCol1Width + 5, itemRowY + 11);
        doc.text(`${unitPrice.toLocaleString('fr-FR', { useGrouping: false })} XAF`, 40 + productsCol1Width + productsCol2Width + 5, itemRowY + 11);
        doc.text(`${itemTotal.toLocaleString('fr-FR', { useGrouping: false })} XAF`, 40 + productsCol1Width + productsCol2Width + productsCol3Width + 5, itemRowY + 11);
      });

      // Total du reçu
      const totalRowY = productsTableStartY + productsRowHeight + (sale.items.length * productsRowHeight);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(40, totalRowY, productsTableWidth, productsRowHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(40, totalRowY, productsTableWidth, productsRowHeight);
      
      doc.text("TOTAL", 40 + productsCol1Width + productsCol2Width + productsCol3Width - 50, totalRowY + 12);
      doc.text(`${Number(sale.total).toLocaleString('fr-FR', { useGrouping: false })} XAF`, 40 + productsCol1Width + productsCol2Width + productsCol3Width + 5, totalRowY + 12);
      
      y = totalRowY + productsRowHeight + 20;
    });
  }

  // Pertes détaillées
  y += 10; doc.setFontSize(14); doc.text("Pertes", 40, y); y += 18; doc.setFontSize(11);
  if (losses.length === 0) {
    doc.text("Aucune perte pour cette période", 40, y); y += 14;
  } else {
    for (const l of losses) {
      const d = new Date(l.createdAt).toLocaleString();
      const line = `${d} • ${l.productName} x${l.quantity} • ${l.cost.toLocaleString('fr-FR', { useGrouping: false })} XAF`;
      doc.text(line, 40, y); y += 14;
      if (y > 760) { doc.addPage(); y = 40; }
    }
  }

  doc.save(fileName || `rapport-${periodLabel}.pdf`);
  try {
    window.dispatchEvent(new CustomEvent('nack:report:downloaded', { detail: { periodLabel, at: Date.now() } }));
  } catch { /* ignore */ }
}; 