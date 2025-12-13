/**
 * Fonctions d'export de données pour le tableau de bord admin
 * Export PDF et CSV des utilisateurs et données clients
 */

import jsPDF from "jspdf";
import type { UserProfile } from "@/types/profile";
import type { PaymentTransaction } from "@/types/payment";

/**
 * Export CSV générique
 */
const exportCsv = (rows: string[][], fileName: string) => {
  // Convertir les lignes en CSV avec gestion des guillemets
  const csvRows = rows.map(row => 
    row.map(cell => {
      // Échapper les guillemets et entourer de guillemets si nécessaire
      const cellStr = String(cell || '').replace(/"/g, '""');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr}"`;
      }
      return cellStr;
    }).join(',')
  );
  
  const csv = csvRows.join('\n');
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
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

/**
 * Export PDF des utilisateurs
 */
export const exportUsersPdf = async (users: UserProfile[], fileName?: string) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const pageWidth = 595;
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Utilisateurs", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [80, 120, 100, 80, 80, 135];
  let x = margin + 5;
  doc.text("Nom", x, y + 14);
  x += colWidths[0];
  doc.text("Établissement", x, y + 14);
  x += colWidths[1];
  doc.text("Email", x, y + 14);
  x += colWidths[2];
  doc.text("Téléphone", x, y + 14);
  x += colWidths[3];
  doc.text("Plan", x, y + 14);
  x += colWidths[4];
  doc.text("Date création", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  let pageNumber = 1;
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 800) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 5;
    doc.text((user.ownerName || '').substring(0, 25), x, y + 14);
    x += colWidths[0];
    doc.text((user.establishmentName || '').substring(0, 30), x, y + 14);
    x += colWidths[1];
    doc.text((user.email || '').substring(0, 35), x, y + 14);
    x += colWidths[2];
    doc.text((user.phone || '').substring(0, 20), x, y + 14);
    x += colWidths[3];
    const plan = user.plan || 'trial';
    const isExpired = plan === "expired" || (user.subscriptionEndsAt ? user.subscriptionEndsAt < Date.now() : false);
    const status = plan === "active" && !isExpired ? "Actif" : plan === "trial" ? "Essai" : "Expiré";
    doc.text(status, x, y + 14);
    x += colWidths[4];
    const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '';
    doc.text(createdAt, x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${users.length} utilisateur(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `utilisateurs-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export CSV des utilisateurs
 */
export const exportUsersCsv = (users: UserProfile[], fileName?: string) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Nom",
      "Établissement",
      "Email",
      "Téléphone",
      "Adresse",
      "Plan",
      "Date création",
      "Date expiration abonnement",
      "RCCM",
      "NIF"
    ],
  ];
  
  // Données
  users.forEach(user => {
    const plan = user.plan || 'trial';
    const isExpired = plan === "expired" || (user.subscriptionEndsAt ? user.subscriptionEndsAt < Date.now() : false);
    const status = plan === "active" && !isExpired ? "Actif" : plan === "trial" ? "Essai" : "Expiré";
    
    rows.push([
      user.ownerName || '',
      user.establishmentName || '',
      user.email || '',
      user.phone || '',
      user.address || '',
      status,
      user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '',
      user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString('fr-FR') : '',
      user.rccm || '',
      user.nif || ''
    ]);
  });
  
  exportCsv(rows, fileName || `utilisateurs-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export CSV des produits
 */
export const exportProductsCsv = (
  products: Array<{ 
    id: string; 
    name: string; 
    category: string; 
    price: number; 
    quantity: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Nom du produit",
      "Catégorie",
      "Prix (XAF)",
      "Quantité",
      "Établissement",
      "Propriétaire",
      "ID Produit"
    ],
  ];
  
  // Données
  products.forEach(product => {
    rows.push([
      product.name || '',
      product.category || '',
      product.price.toString(),
      product.quantity.toString(),
      product.establishmentName || '',
      product.userName || '',
      product.id
    ]);
  });
  
  exportCsv(rows, fileName || `produits-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export CSV des commandes
 */
export const exportOrdersCsv = (
  orders: Array<{ 
    id: string; 
    orderNumber: number; 
    tableNumber: string; 
    total: number; 
    status: string; 
    createdAt: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Numéro de commande",
      "Table",
      "Total (XAF)",
      "Statut",
      "Date",
      "Établissement",
      "Propriétaire",
      "ID Commande"
    ],
  ];
  
  // Données
  orders.forEach(order => {
    rows.push([
      order.orderNumber.toString(),
      order.tableNumber || '',
      order.total.toString(),
      order.status || '',
      new Date(order.createdAt).toLocaleString('fr-FR'),
      order.establishmentName || '',
      order.userName || '',
      order.id
    ]);
  });
  
  exportCsv(rows, fileName || `commandes-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export CSV des événements
 */
export const exportEventsCsv = (
  events: Array<{ 
    id: string; 
    title: string; 
    date: string; 
    time: string; 
    location: string; 
    maxCapacity: number; 
    ticketPrice: number; 
    ticketsSold: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Titre",
      "Date",
      "Heure",
      "Lieu",
      "Capacité max",
      "Prix billet (XAF)",
      "Billets vendus",
      "Établissement",
      "Propriétaire",
      "ID Événement"
    ],
  ];
  
  // Données
  events.forEach(event => {
    rows.push([
      event.title || '',
      event.date || '',
      event.time || '',
      event.location || '',
      event.maxCapacity.toString(),
      event.ticketPrice.toString(),
      event.ticketsSold.toString(),
      event.establishmentName || '',
      event.userName || '',
      event.id
    ]);
  });
  
  exportCsv(rows, fileName || `evenements-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export CSV des paiements
 */
export const exportPaymentsCsv = (
  payments: Array<PaymentTransaction & { userEmail?: string; userName?: string }>,
  fileName?: string
) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Montant (XAF)",
      "Plan",
      "Statut",
      "Méthode de paiement",
      "Date de paiement",
      "Date de création",
      "Email utilisateur",
      "Nom utilisateur",
      "ID Transaction"
    ],
  ];
  
  // Données
  payments.forEach(payment => {
    rows.push([
      payment.amount?.toString() || '0',
      payment.planType || '',
      payment.status || '',
      payment.paymentMethod || '',
      payment.paidAt ? new Date(payment.paidAt).toLocaleString('fr-FR') : '',
      payment.createdAt ? new Date(payment.createdAt).toLocaleString('fr-FR') : '',
      payment.userEmail || '',
      payment.userName || '',
      payment.id || ''
    ]);
  });
  
  exportCsv(rows, fileName || `paiements-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export CSV des clients (tous les clients de tous les utilisateurs)
 */
export const exportCustomersCsv = (
  customers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    customerId?: string;
    loyaltyType?: string;
    status?: string;
    points?: number;
    totalPointsEarned?: number;
    totalAmountSpent?: number;
    totalOrders?: number;
    lastVisit?: Date;
    createdAt?: Date;
    userId: string;
    userName?: string;
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const rows: string[][] = [
    // En-têtes
    [
      "Prénom",
      "Nom",
      "Téléphone",
      "Email",
      "ID Client",
      "Type fidélité",
      "Statut",
      "Points actuels",
      "Points totaux gagnés",
      "Montant total dépensé (XAF)",
      "Nombre de commandes",
      "Dernière visite",
      "Date création",
      "Établissement",
      "Propriétaire"
    ],
  ];
  
  // Données
  customers.forEach(customer => {
    rows.push([
      customer.firstName || '',
      customer.lastName || '',
      customer.phone || '',
      customer.email || '',
      customer.customerId || '',
      customer.loyaltyType || '',
      customer.status || '',
      (customer.points || 0).toString(),
      (customer.totalPointsEarned || 0).toString(),
      (customer.totalAmountSpent || 0).toString(),
      (customer.totalOrders || 0).toString(),
      customer.lastVisit ? customer.lastVisit.toLocaleDateString('fr-FR') : '',
      customer.createdAt ? customer.createdAt.toLocaleDateString('fr-FR') : '',
      customer.establishmentName || '',
      customer.userName || ''
    ]);
  });
  
  exportCsv(rows, fileName || `clients-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export PDF des produits
 */
export const exportProductsPdf = async (
  products: Array<{ 
    id: string; 
    name: string; 
    category: string; 
    price: number; 
    quantity: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const pageWidth = 595;
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Produits", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [120, 80, 80, 60, 120, 135];
  let x = margin + 5;
  doc.text("Produit", x, y + 14);
  x += colWidths[0];
  doc.text("Catégorie", x, y + 14);
  x += colWidths[1];
  doc.text("Prix", x, y + 14);
  x += colWidths[2];
  doc.text("Qté", x, y + 14);
  x += colWidths[3];
  doc.text("Établissement", x, y + 14);
  x += colWidths[4];
  doc.text("Propriétaire", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  let pageNumber = 1;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 800) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 5;
    doc.text((product.name || '').substring(0, 25), x, y + 14);
    x += colWidths[0];
    doc.text((product.category || '').substring(0, 20), x, y + 14);
    x += colWidths[1];
    doc.text(`${product.price.toLocaleString()} XAF`, x, y + 14);
    x += colWidths[2];
    doc.text(product.quantity.toString(), x, y + 14);
    x += colWidths[3];
    doc.text((product.establishmentName || '').substring(0, 25), x, y + 14);
    x += colWidths[4];
    doc.text((product.userName || '').substring(0, 25), x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${products.length} produit(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `produits-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF des commandes
 */
export const exportOrdersPdf = async (
  orders: Array<{ 
    id: string; 
    orderNumber: number; 
    tableNumber: string; 
    total: number; 
    status: string; 
    createdAt: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const pageWidth = 595;
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Commandes", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [80, 60, 80, 80, 100, 120, 75];
  let x = margin + 5;
  doc.text("N°", x, y + 14);
  x += colWidths[0];
  doc.text("Table", x, y + 14);
  x += colWidths[1];
  doc.text("Total", x, y + 14);
  x += colWidths[2];
  doc.text("Statut", x, y + 14);
  x += colWidths[3];
  doc.text("Date", x, y + 14);
  x += colWidths[4];
  doc.text("Établissement", x, y + 14);
  x += colWidths[5];
  doc.text("Propriétaire", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  let pageNumber = 1;
  
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 800) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 5;
    doc.text(`#${order.orderNumber}`, x, y + 14);
    x += colWidths[0];
    doc.text(order.tableNumber || '-', x, y + 14);
    x += colWidths[1];
    doc.text(`${order.total.toLocaleString()} XAF`, x, y + 14);
    x += colWidths[2];
    doc.text(order.status || '', x, y + 14);
    x += colWidths[3];
    doc.text(new Date(order.createdAt).toLocaleDateString('fr-FR'), x, y + 14);
    x += colWidths[4];
    doc.text((order.establishmentName || '').substring(0, 20), x, y + 14);
    x += colWidths[5];
    doc.text((order.userName || '').substring(0, 15), x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${orders.length} commande(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `commandes-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF des événements
 */
export const exportEventsPdf = async (
  events: Array<{ 
    id: string; 
    title: string; 
    date: string; 
    time: string; 
    location: string; 
    maxCapacity: number; 
    ticketPrice: number; 
    ticketsSold: number; 
    userId: string; 
    userName?: string; 
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const pageWidth = 595;
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Événements", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [100, 70, 50, 100, 50, 50, 70, 100, 75];
  let x = margin + 5;
  doc.text("Titre", x, y + 14);
  x += colWidths[0];
  doc.text("Date", x, y + 14);
  x += colWidths[1];
  doc.text("Heure", x, y + 14);
  x += colWidths[2];
  doc.text("Lieu", x, y + 14);
  x += colWidths[3];
  doc.text("Capacité", x, y + 14);
  x += colWidths[4];
  doc.text("Vendus", x, y + 14);
  x += colWidths[5];
  doc.text("Prix", x, y + 14);
  x += colWidths[6];
  doc.text("Établissement", x, y + 14);
  x += colWidths[7];
  doc.text("Propriétaire", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  let pageNumber = 1;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 800) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 5;
    doc.text((event.title || '').substring(0, 20), x, y + 14);
    x += colWidths[0];
    doc.text(new Date(event.date).toLocaleDateString('fr-FR'), x, y + 14);
    x += colWidths[1];
    doc.text(event.time || '', x, y + 14);
    x += colWidths[2];
    doc.text((event.location || '').substring(0, 20), x, y + 14);
    x += colWidths[3];
    doc.text(event.maxCapacity.toString(), x, y + 14);
    x += colWidths[4];
    doc.text(event.ticketsSold.toString(), x, y + 14);
    x += colWidths[5];
    doc.text(`${event.ticketPrice.toLocaleString()} XAF`, x, y + 14);
    x += colWidths[6];
    doc.text((event.establishmentName || '').substring(0, 20), x, y + 14);
    x += colWidths[7];
    doc.text((event.userName || '').substring(0, 15), x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${events.length} événement(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `evenements-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF des paiements
 */
export const exportPaymentsPdf = async (
  payments: Array<PaymentTransaction & { userEmail?: string; userName?: string }>,
  fileName?: string
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;
  const pageWidth = 595;
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Paiements", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [80, 80, 70, 90, 90, 100, 85];
  let x = margin + 5;
  doc.text("Montant", x, y + 14);
  x += colWidths[0];
  doc.text("Plan", x, y + 14);
  x += colWidths[1];
  doc.text("Statut", x, y + 14);
  x += colWidths[2];
  doc.text("Méthode", x, y + 14);
  x += colWidths[3];
  doc.text("Date paiement", x, y + 14);
  x += colWidths[4];
  doc.text("Utilisateur", x, y + 14);
  x += colWidths[5];
  doc.text("Email", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  let pageNumber = 1;
  
  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 800) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 5;
    doc.text(`${(payment.amount || 0).toLocaleString()} XAF`, x, y + 14);
    x += colWidths[0];
    doc.text((payment.planType || '').substring(0, 15), x, y + 14);
    x += colWidths[1];
    doc.text((payment.status || '').substring(0, 15), x, y + 14);
    x += colWidths[2];
    doc.text((payment.paymentMethod || '').substring(0, 18), x, y + 14);
    x += colWidths[3];
    doc.text(payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('fr-FR') : '-', x, y + 14);
    x += colWidths[4];
    doc.text((payment.userName || '').substring(0, 20), x, y + 14);
    x += colWidths[5];
    doc.text((payment.userEmail || '').substring(0, 20), x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${payments.length} paiement(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `paiements-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF des clients
 */
export const exportCustomersPdf = async (
  customers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    customerId?: string;
    loyaltyType?: string;
    status?: string;
    points?: number;
    totalPointsEarned?: number;
    totalAmountSpent?: number;
    totalOrders?: number;
    lastVisit?: Date;
    createdAt?: Date;
    userId: string;
    userName?: string;
    establishmentName?: string;
  }>,
  fileName?: string
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  let y = 40;
  const pageWidth = 842; // Landscape A4 width
  const margin = 40;
  const tableWidth = pageWidth - (2 * margin);
  const rowHeight = 20;
  
  // En-tête
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text("Liste des Clients", margin, y);
  y += 30;
  
  // Date d'export
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, y);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // En-têtes du tableau
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, tableWidth, rowHeight);
  
  const colWidths = [60, 60, 70, 80, 60, 50, 50, 50, 50, 70, 50, 60, 60, 80, 70];
  let x = margin + 3;
  doc.text("Prénom", x, y + 14);
  x += colWidths[0];
  doc.text("Nom", x, y + 14);
  x += colWidths[1];
  doc.text("Téléphone", x, y + 14);
  x += colWidths[2];
  doc.text("Email", x, y + 14);
  x += colWidths[3];
  doc.text("ID Client", x, y + 14);
  x += colWidths[4];
  doc.text("Type", x, y + 14);
  x += colWidths[5];
  doc.text("Statut", x, y + 14);
  x += colWidths[6];
  doc.text("Points", x, y + 14);
  x += colWidths[7];
  doc.text("Total pts", x, y + 14);
  x += colWidths[8];
  doc.text("Montant", x, y + 14);
  x += colWidths[9];
  doc.text("Commandes", x, y + 14);
  x += colWidths[10];
  doc.text("Dern. visite", x, y + 14);
  x += colWidths[11];
  doc.text("Création", x, y + 14);
  x += colWidths[12];
  doc.text("Établissement", x, y + 14);
  x += colWidths[13];
  doc.text("Propriétaire", x, y + 14);
  
  y += rowHeight;
  
  // Données
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  let pageNumber = 1;
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    // Nouvelle page si nécessaire
    if (y + rowHeight > 550) {
      doc.addPage();
      y = 40;
      pageNumber++;
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, 30);
      doc.setFontSize(8);
    }
    
    // Fond alterné
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    
    // Bordures
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, tableWidth, rowHeight);
    
    // Données
    x = margin + 3;
    doc.text((customer.firstName || '').substring(0, 12), x, y + 14);
    x += colWidths[0];
    doc.text((customer.lastName || '').substring(0, 12), x, y + 14);
    x += colWidths[1];
    doc.text((customer.phone || '').substring(0, 14), x, y + 14);
    x += colWidths[2];
    doc.text((customer.email || '').substring(0, 16), x, y + 14);
    x += colWidths[3];
    doc.text((customer.customerId || '').substring(0, 12), x, y + 14);
    x += colWidths[4];
    doc.text((customer.loyaltyType || '').substring(0, 10), x, y + 14);
    x += colWidths[5];
    doc.text((customer.status || '').substring(0, 10), x, y + 14);
    x += colWidths[6];
    doc.text((customer.points || 0).toString(), x, y + 14);
    x += colWidths[7];
    doc.text((customer.totalPointsEarned || 0).toString(), x, y + 14);
    x += colWidths[8];
    doc.text(`${(customer.totalAmountSpent || 0).toLocaleString()} XAF`, x, y + 14);
    x += colWidths[9];
    doc.text((customer.totalOrders || 0).toString(), x, y + 14);
    x += colWidths[10];
    doc.text(customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString('fr-FR') : '-', x, y + 14);
    x += colWidths[11];
    doc.text(customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('fr-FR') : '-', x, y + 14);
    x += colWidths[12];
    doc.text((customer.establishmentName || '').substring(0, 16), x, y + 14);
    x += colWidths[13];
    doc.text((customer.userName || '').substring(0, 14), x, y + 14);
    
    y += rowHeight;
  }
  
  // Pied de page
  doc.setFontSize(8);
  doc.text(`Total: ${customers.length} client(s)`, margin, y + 10);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, y + 10);
  
  doc.save(fileName || `clients-${new Date().toISOString().split('T')[0]}.pdf`);
};

