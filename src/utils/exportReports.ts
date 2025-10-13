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

  // Résumé
  doc.setFontSize(12);
  doc.text(`Ventes: ${summary.ventes.toLocaleString()} XAF`, 40, y); y += 16;
  doc.text(`Commandes: ${summary.commandes}`, 40, y); y += 16;
  doc.text(`Pertes: ${summary.pertes.toLocaleString()} XAF`, 40, y); y += 16;
  doc.text(`Bénéfice net: ${summary.benefice.toLocaleString()} XAF`, 40, y); y += 24;

  // Commandes détaillées
  doc.setFontSize(14); doc.text("Commandes", 40, y); y += 18; doc.setFontSize(11);
  if (orders.length === 0) {
    doc.text("Aucune commande pour cette période", 40, y); y += 14;
  } else {
    for (const o of orders) {
      const d = new Date(o.createdAt).toLocaleString();
      const agent = o.agentName ? `${o.agentName}${o.agentCode ? ` (${o.agentCode})` : ''}` : (o.agentCode || "");
      const line = `${d} • Table ${o.tableNumber || ''} • ${o.total.toLocaleString()} XAF • ${o.status || ''}`;
      doc.text(line, 40, y); y += 14;
      if (agent) { doc.text(`Agent: ${agent}`, 60, y); y += 14; }
      if (y > 760) { doc.addPage(); y = 40; }
    }
  }
  y += 10;

  // Ventes détaillées
  doc.setFontSize(14); doc.text("Ventes", 40, y); y += 18; doc.setFontSize(11);
  if (sales.length === 0) {
    doc.text("Aucune vente pour cette période", 40, y); y += 14;
  } else {
    for (const s of sales) {
      const d = new Date(s.createdAt).toLocaleString();
      const items = s.items.map(i => `${i.name} x${i.quantity}`).join(", ");
      const line = `${d} • ${s.paymentMethod} • ${s.total.toLocaleString()} XAF`;
      doc.text(line, 40, y); y += 14;
      doc.text(items, 60, y); y += 14;
      if (y > 760) { doc.addPage(); y = 40; }
    }
  }

  // Pertes détaillées
  y += 10; doc.setFontSize(14); doc.text("Pertes", 40, y); y += 18; doc.setFontSize(11);
  if (losses.length === 0) {
    doc.text("Aucune perte pour cette période", 40, y); y += 14;
  } else {
    for (const l of losses) {
      const d = new Date(l.createdAt).toLocaleString();
      const line = `${d} • ${l.productName} x${l.quantity} • ${l.cost.toLocaleString()} XAF`;
      doc.text(line, 40, y); y += 14;
      if (y > 760) { doc.addPage(); y = 40; }
    }
  }

  doc.save(fileName || `rapport-${periodLabel}.pdf`);
  try {
    window.dispatchEvent(new CustomEvent('nack:report:downloaded', { detail: { periodLabel, at: Date.now() } }));
  } catch { /* ignore */ }
}; 