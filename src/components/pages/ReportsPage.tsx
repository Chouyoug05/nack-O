import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Download
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { lossesColRef, salesColRef, ordersColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import type { SaleDoc, LossDoc, SaleItem } from "@/types/inventory";
import type { LucideIcon } from "lucide-react";
import { exportSalesCsv, exportSalesPdf } from "@/utils/exportReports";

interface FsOrderDoc {
  createdAt?: number;
  total?: number;
  tableNumber?: string;
  status?: string;
  agentName?: string;
  agentCode?: string;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const usePeriodData = (uid: string | undefined, period: 'daily' | 'weekly' | 'monthly') => {
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [losses, setLosses] = useState<LossDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = period === 'daily'
      ? now - dayMs
      : period === 'weekly'
        ? now - 7 * dayMs
        : now - 30 * dayMs;

    const qSales = query(salesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
    const qLosses = query(lossesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));

    const unsub1 = onSnapshot(qSales, (snap) => {
      setSales(snap.docs.map(d => d.data() as SaleDoc));
    });
    const unsub2 = onSnapshot(qLosses, (snap) => {
      setLosses(snap.docs.map(d => d.data() as LossDoc));
    });

    return () => { unsub1(); unsub2(); };
  }, [uid, period]);

  const ventes = useMemo(() => sum(sales.map(s => s.total)), [sales]);
  const commandes = sales.length;
  const pertes = useMemo(() => sum(losses.map(l => l.cost)), [losses]);
  const benefice = Math.max(ventes - pertes, 0);

  return { ventes, commandes, pertes, benefice, sales };
};

interface ReportCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: LucideIcon;
  trend: 'up' | 'down' | 'flat';
}

const ReportCard = ({ title, value, change, icon: Icon, trend }: ReportCardProps) => (
  <Card className="shadow-card border-0">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className={`text-sm flex items-center gap-1 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {trend === 'up' && <TrendingUp size={16} />}
            {trend === 'down' && <TrendingDown size={16} />}
            {change}
          </p>
        </div>
        <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
          <Icon size={24} className="text-nack-red" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const SalesMiniChart = ({ data }: { data: Array<{ label: string; value: number }> }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  const barWidth = Math.max(12, Math.floor(280 / Math.max(1, data.length)));
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2 h-36">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center min-w-[40px]">
            <div
              className="w-6 rounded-t bg-gradient-primary"
              style={{ height: `${(d.value / max) * 100}%` }}
              title={`${d.label}: ${d.value.toLocaleString()} XAF`}
            />
            <span className="mt-2 text-xs text-muted-foreground truncate max-w-[40px]">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TopProductsList = ({ sales }: { sales: SaleDoc[] }) => {
  const top = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      for (const it of (s.items || [])) {
        const prev = map.get(it.name) || { name: it.name, qty: 0, total: 0 };
        prev.qty += Number(it.quantity || 0);
        prev.total += Number(it.price || 0) * Number(it.quantity || 0);
        map.set(it.name, prev);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);
  return (
    <div className="space-y-2">
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun article dans la période</p>
      ) : (
        top.map((p) => (
          <div key={p.name} className="flex items-center justify-between p-2 bg-nack-beige-light rounded">
            <div className="text-sm font-medium truncate mr-2">{p.name}</div>
            <div className="text-xs text-muted-foreground">x{p.qty}</div>
            <div className="text-sm font-semibold">{p.total.toLocaleString()} XAF</div>
          </div>
        ))
      )}
    </div>
  );
};

const ReportsPage = () => {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const daily = usePeriodData(uid, 'daily');
  const weekly = usePeriodData(uid, 'weekly');
  const monthly = usePeriodData(uid, 'monthly');
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const current = activeTab === 'daily' ? daily : activeTab === 'weekly' ? weekly : monthly;
  const chartData = useMemo(() => {
    // Regrouper par jour (locale date) pour la période active
    const acc = new Map<string, number>();
    for (const s of current.sales || []) {
      const label = new Date(s.createdAt).toLocaleDateString();
      acc.set(label, (acc.get(label) || 0) + Number(s.total || 0));
    }
    // Trier par date ascendante
    const entries = Array.from(acc.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    return entries.map(([label, value]) => ({ label, value }));
  }, [current]);

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!uid) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = activeTab === 'daily' ? now - dayMs : activeTab === 'weekly' ? now - 7 * dayMs : now - 30 * dayMs;

    const qSales = query(salesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
    const qLosses = query(lossesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
    const qOrders = query(ordersColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
    const [salesSnap, lossesSnap, ordersSnap] = await Promise.all([getDocs(qSales), getDocs(qLosses), getDocs(qOrders)]);
    const sales = salesSnap.docs.map(d => d.data() as SaleDoc);
    const losses = lossesSnap.docs.map(d => d.data() as LossDoc);
    const orders = ordersSnap.docs.map(d => {
      const o = d.data() as FsOrderDoc;
      return {
        createdAt: Number(o.createdAt || 0),
        total: Number(o.total || 0),
        tableNumber: String(o.tableNumber || ''),
        status: String(o.status || ''),
        agentName: o.agentName,
        agentCode: o.agentCode,
      };
    });

    if (type === 'pdf') {
      await exportSalesPdf({
        sales,
        losses,
        orders,
        periodLabel: activeTab,
        summary: activeTab === 'daily' ? daily : activeTab === 'weekly' ? weekly : monthly,
        org: {
          establishmentName: profile?.establishmentName || 'Mon Établissement',
          establishmentType: profile?.establishmentType,
          ownerName: profile?.ownerName,
          email: profile?.email,
          phone: profile?.phone,
          logoUrl: profile?.logoUrl || '/favicon.png',
        },
      });
    } else {
      exportSalesCsv({ sales, losses, orders, periodLabel: activeTab });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Rapports & Analyses</h2>
          <p className="text-sm text-muted-foreground">Suivez les performances de votre établissement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="nack-outline" size="sm" className="gap-2" onClick={() => handleExport('csv')}>
            <Download size={16} />
            Exporter CSV
          </Button>
          <Button variant="nack-outline" size="sm" className="gap-2" onClick={() => handleExport('pdf')}>
            <Download size={16} />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Onglets des rapports */}
      <Tabs defaultValue="daily" className="w-full" onValueChange={(v: string) => setActiveTab(v as 'daily' | 'weekly' | 'monthly')}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar size={16} />
            Journalier
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            <Calendar size={16} />
            Hebdomadaire
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar size={16} />
            Mensuel
          </TabsTrigger>
        </TabsList>

        {/* Rapport Journalier */}
        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard 
              title="Ventes du jour"
              value={`${daily.ventes.toLocaleString()} XAF`}
              change=""
              icon={DollarSign}
              trend="up"
            />
            <ReportCard 
              title="Commandes"
              value={daily.commandes}
              change=""
              icon={ShoppingBag}
              trend="up"
            />
            <ReportCard 
              title="Pertes"
              value={`${daily.pertes.toLocaleString()} XAF`}
              change=""
              icon={AlertTriangle}
              trend="down"
            />
            <ReportCard 
              title="Bénéfice net"
              value={`${daily.benefice.toLocaleString()} XAF`}
              change=""
              icon={TrendingUp}
              trend="up"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Évolution des ventes</CardTitle>
                <CardDescription>Somme par jour</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesMiniChart data={chartData} />
              </CardContent>
            </Card>
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Top produits</CardTitle>
                <CardDescription>Meilleures ventes</CardDescription>
              </CardHeader>
              <CardContent>
                <TopProductsList sales={daily.sales} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rapport Hebdomadaire */}
        <TabsContent value="weekly" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard 
              title="Ventes de la semaine"
              value={`${weekly.ventes.toLocaleString()} XAF`}
              change=""
              icon={DollarSign}
              trend="up"
            />
            <ReportCard 
              title="Commandes"
              value={weekly.commandes}
              change=""
              icon={ShoppingBag}
              trend="up"
            />
            <ReportCard 
              title="Pertes"
              value={`${weekly.pertes.toLocaleString()} XAF`}
              change=""
              icon={AlertTriangle}
              trend="down"
            />
            <ReportCard 
              title="Bénéfice net"
              value={`${weekly.benefice.toLocaleString()} XAF`}
              change=""
              icon={TrendingUp}
              trend="up"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Évolution des ventes</CardTitle>
                <CardDescription>Somme par jour</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesMiniChart data={chartData} />
              </CardContent>
            </Card>
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Top produits</CardTitle>
                <CardDescription>Meilleures ventes</CardDescription>
              </CardHeader>
              <CardContent>
                <TopProductsList sales={weekly.sales} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rapport Mensuel */}
        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard 
              title="Ventes du mois"
              value={`${monthly.ventes.toLocaleString()} XAF`}
              change=""
              icon={DollarSign}
              trend="up"
            />
            <ReportCard 
              title="Commandes"
              value={monthly.commandes}
              change=""
              icon={ShoppingBag}
              trend="up"
            />
            <ReportCard 
              title="Pertes"
              value={`${monthly.pertes.toLocaleString()} XAF`}
              change=""
              icon={AlertTriangle}
              trend="down"
            />
            <ReportCard 
              title="Bénéfice net"
              value={`${monthly.benefice.toLocaleString()} XAF`}
              change=""
              icon={TrendingUp}
              trend="up"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Évolution des ventes</CardTitle>
                <CardDescription>Somme par jour</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesMiniChart data={chartData} />
              </CardContent>
            </Card>
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Top produits</CardTitle>
                <CardDescription>Meilleures ventes</CardDescription>
              </CardHeader>
              <CardContent>
                <TopProductsList sales={monthly.sales} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;