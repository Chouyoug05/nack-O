import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  Calendar,
  Download,
  BarChart3,
  Star,
  CreditCard,
  TrendingUp,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { lossesColRef, salesColRef, ordersColRef, productsColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import type { SaleDoc, LossDoc, SaleItem } from "@/types/inventory";
import { exportSalesCsv, exportSalesPdf } from "@/utils/exportReports";

interface FsOrderDoc {
  createdAt?: number;
  total?: number;
  tableNumber?: string;
  status?: string;
  agentName?: string;
  agentCode?: string;
}

interface Product {
  id: string;
  name: string;
  imageUrl?: string;
  quantity?: number;
  category?: string;
}

interface DailyData {
  date: string;
  ventes: number;
  commandes: number;
  pertes: number;
  benefice: number;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const usePeriodData = (uid: string | undefined, period: 'daily' | 'weekly' | 'monthly') => {
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [losses, setLosses] = useState<LossDoc[]>([]);
  const initializedRef = useRef<string>('');
  const hasReceivedValidSalesRef = useRef<boolean>(false);
  const hasReceivedValidLossesRef = useRef<boolean>(false);

  useEffect(() => {
    if (!uid) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Pour la période 'daily', calculer depuis minuit (00:00:00) du jour actuel
    let start: number;
    if (period === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Mettre à minuit
      start = today.getTime();
    } else if (period === 'weekly') {
      start = now - 7 * dayMs;
    } else {
      start = now - 30 * dayMs;
    }

    const periodKey = `${uid}-${period}`;
    
    // Réinitialiser uniquement si la période ou l'uid change
    if (initializedRef.current !== periodKey) {
      initializedRef.current = '';
      hasReceivedValidSalesRef.current = false;
      hasReceivedValidLossesRef.current = false;
      setSales([]);
      setLosses([]);
    }

    const qSales = query(salesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));
    const qLosses = query(lossesColRef(db, uid), where('createdAt', '>=', start), orderBy('createdAt', 'desc'));

    let salesInitialized = false;
    let lossesInitialized = false;

    const unsub1 = onSnapshot(qSales, (snap) => {
      const newSales = snap.docs.map(d => {
        const data = d.data() as SaleDoc;
        return data;
      });
      
      // Marquer qu'on a reçu des données valides si le snapshot contient des données
      if (newSales.length > 0) {
        hasReceivedValidSalesRef.current = true;
      }
      
      // Toujours accepter les snapshots du serveur (source de vérité)
      // Mais ignorer les snapshots vides du cache une fois qu'on a reçu des données valides
      const isFromServer = !snap.metadata.fromCache;
      
      // Utiliser une fonction de mise à jour pour préserver les données si nécessaire
      setSales(prev => {
        // Si c'est du serveur, toujours accepter (source de vérité)
        if (isFromServer) {
          return newSales;
        }
        
        // Si c'est du cache et qu'on n'a jamais eu de données valides, accepter
        if (!hasReceivedValidSalesRef.current) {
          return newSales;
        }
        
        // Si c'est du cache, on a déjà des données valides, et le nouveau snapshot est vide : conserver les données précédentes
        if (newSales.length === 0 && prev.length > 0) {
          return prev;
        }
        
        // Sinon, accepter les nouvelles données
        return newSales;
      });
      
      if (!salesInitialized) {
        salesInitialized = true;
        if (initializedRef.current !== periodKey) {
          initializedRef.current = periodKey;
        }
      }
    }, (error) => {
      console.error('Erreur snapshot sales:', error);
    });
    
    const unsub2 = onSnapshot(qLosses, (snap) => {
      const newLosses = snap.docs.map(d => {
        const data = d.data() as LossDoc;
        return data;
      });
      
      // Marquer qu'on a reçu des données valides si le snapshot contient des données
      if (newLosses.length > 0) {
        hasReceivedValidLossesRef.current = true;
      }
      
      // Toujours accepter les snapshots du serveur (source de vérité)
      // Mais ignorer les snapshots vides du cache une fois qu'on a reçu des données valides
      const isFromServer = !snap.metadata.fromCache;
      
      // Utiliser une fonction de mise à jour pour préserver les données si nécessaire
      setLosses(prev => {
        // Si c'est du serveur, toujours accepter (source de vérité)
        if (isFromServer) {
          return newLosses;
        }
        
        // Si c'est du cache et qu'on n'a jamais eu de données valides, accepter
        if (!hasReceivedValidLossesRef.current) {
          return newLosses;
        }
        
        // Si c'est du cache, on a déjà des données valides, et le nouveau snapshot est vide : conserver les données précédentes
        if (newLosses.length === 0 && prev.length > 0) {
          return prev;
        }
        
        // Sinon, accepter les nouvelles données
        return newLosses;
      });
      
      if (!lossesInitialized) {
        lossesInitialized = true;
        if (initializedRef.current !== periodKey) {
          initializedRef.current = periodKey;
        }
      }
    }, (error) => {
      console.error('Erreur snapshot losses:', error);
    });

    return () => { unsub1(); unsub2(); };
  }, [uid, period]);

  // Calculs explicites pour forcer l'affichage dans Chrome
  const ventes = useMemo(() => {
    const total = sum(sales.map(s => {
      const val = Number((s.total as unknown as number) || 0);
      return Number(val) || 0;
    }));
    return Number(total) || 0;
  }, [sales]);
  const commandes = sales.length;
  const pertes = useMemo(() => {
    const total = sum(losses.map(l => {
      const val = Number((l.cost as unknown as number) || 0);
      return Number(val) || 0;
    }));
    return Number(total) || 0;
  }, [losses]);
  const benefice = useMemo(() => {
    const result = Math.max(Number(ventes) - Number(pertes), 0);
    return Number(result) || 0;
  }, [ventes, pertes]);

  return { ventes, commandes, pertes, benefice, sales, losses };
};

const ReportsPage = () => {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const [products, setProducts] = useState<Product[]>([]);
  const [activePeriod, setActivePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());

  const daily = usePeriodData(uid, 'daily');
  const weekly = usePeriodData(uid, 'weekly');
  const monthly = usePeriodData(uid, 'monthly');
  
  const current = activePeriod === 'daily' ? daily : activePeriod === 'weekly' ? weekly : monthly;

  // Charger les produits pour récupérer les images (toutes catégories)
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(productsColRef(db, uid), (snap) => {
      const list: Product[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        imageUrl: d.data().imageUrl,
        quantity: Number(d.data().quantity || 0),
        category: d.data().category || '',
      }));
      setProducts(list);
    });
    return () => unsub();
  }, [uid]);

  // Top produits avec images (toutes catégories)
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number; productId?: string; category?: string }>();
    for (const s of current.sales || []) {
      for (const it of (s.items || [] as unknown as SaleItem[])) {
        const prev = map.get(it.name) || { name: it.name, qty: 0, total: 0, productId: it.id };
        prev.qty += Number((it.quantity as unknown as number) || 0);
        prev.total += Number((it.price as unknown as number) || 0) * Number((it.quantity as unknown as number) || 0);
        if (it.id) prev.productId = it.id;
        map.set(it.name, prev);
      }
    }
    return Array.from(map.values())
      .map(p => {
        const product = products.find(prod => prod.name === p.name || prod.id === p.productId);
        return { ...p, imageUrl: product?.imageUrl, category: product?.category };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [current.sales, products]);

  // Données quotidiennes pour la semaine
  const weeklyDailyData = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6); // 7 derniers jours
    startOfWeek.setHours(0, 0, 0, 0);

    const dailyMap = new Map<string, DailyData>();
    
    // Initialiser tous les jours de la semaine
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toLocaleDateString('fr-FR');
      dailyMap.set(dateStr, {
        date: dateStr,
        ventes: 0,
        commandes: 0,
        pertes: 0,
        benefice: 0,
      });
    }

    // Remplir avec les ventes
    for (const s of weekly.sales || []) {
      const ts = Number((s.createdAt as unknown as number) || 0);
      if (!ts || ts === 0) continue;
      const saleDate = new Date(ts);
      if (isNaN(saleDate.getTime())) continue;
      const dateStr = saleDate.toLocaleDateString('fr-FR');
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        const total = Number((s.total as unknown as number) || 0);
        dayData.ventes = Number(dayData.ventes) + (Number(total) || 0);
        dayData.commandes = Number(dayData.commandes) + 1;
      }
    }

    // Remplir avec les pertes
    for (const l of weekly.losses || []) {
      const ts = Number((l.createdAt as unknown as number) || 0);
      if (!ts || ts === 0) continue;
      const lossDate = new Date(ts);
      if (isNaN(lossDate.getTime())) continue;
      const dateStr = lossDate.toLocaleDateString('fr-FR');
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        const cost = Number((l.cost as unknown as number) || 0);
        dayData.pertes = Number(dayData.pertes) + (Number(cost) || 0);
      }
    }

    // Calculer les bénéfices
    dailyMap.forEach((data) => {
      data.ventes = Number(data.ventes) || 0;
      data.pertes = Number(data.pertes) || 0;
      data.benefice = Math.max(Number(data.ventes) - Number(data.pertes), 0);
    });

    return Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date.split('/').reverse().join('-')).getTime() - 
      new Date(b.date.split('/').reverse().join('-')).getTime()
    );
  }, [weekly.sales, weekly.losses]);

  // Données quotidiennes pour le mois
  const monthlyDailyData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyMap = new Map<string, DailyData>();

    // Initialiser tous les jours du mois
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(startOfMonth);
      date.setDate(startOfMonth.getDate() + i);
      const dateStr = date.toLocaleDateString('fr-FR');
      dailyMap.set(dateStr, {
        date: dateStr,
        ventes: 0,
        commandes: 0,
        pertes: 0,
        benefice: 0,
      });
    }

    // Remplir avec les ventes
    for (const s of monthly.sales || []) {
      const ts = Number((s.createdAt as unknown as number) || 0);
      if (!ts || ts === 0) continue;
      const saleDate = new Date(ts);
      if (isNaN(saleDate.getTime())) continue;
      const dateStr = saleDate.toLocaleDateString('fr-FR');
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        const total = Number((s.total as unknown as number) || 0);
        dayData.ventes = Number(dayData.ventes) + (Number(total) || 0);
        dayData.commandes = Number(dayData.commandes) + 1;
      }
    }

    // Remplir avec les pertes
    for (const l of monthly.losses || []) {
      const ts = Number((l.createdAt as unknown as number) || 0);
      if (!ts || ts === 0) continue;
      const lossDate = new Date(ts);
      if (isNaN(lossDate.getTime())) continue;
      const dateStr = lossDate.toLocaleDateString('fr-FR');
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        const cost = Number((l.cost as unknown as number) || 0);
        dayData.pertes = Number(dayData.pertes) + (Number(cost) || 0);
      }
    }

    // Calculer les bénéfices
    dailyMap.forEach((data) => {
      data.ventes = Number(data.ventes) || 0;
      data.pertes = Number(data.pertes) || 0;
      data.benefice = Math.max(Number(data.ventes) - Number(data.pertes), 0);
    });

    return Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date.split('/').reverse().join('-')).getTime() - 
      new Date(b.date.split('/').reverse().join('-')).getTime()
    );
  }, [monthly.sales, monthly.losses]);

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!uid) return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = activePeriod === 'daily' ? now - dayMs : activePeriod === 'weekly' ? now - 7 * dayMs : now - 30 * dayMs;

    const startDate = new Date(start);
    const endDate = new Date(now);
    
    let periodLabel = '';
    if (activePeriod === 'daily') {
      periodLabel = `Journalier - ${startDate.toLocaleDateString()}`;
    } else if (activePeriod === 'weekly') {
      periodLabel = `Hebdomadaire - Du ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}`;
    } else {
      periodLabel = `Mensuel - ${startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    }

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
        periodLabel,
        summary: activePeriod === 'daily' ? daily : activePeriod === 'weekly' ? weekly : monthly,
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
      exportSalesCsv({ sales, losses, orders, periodLabel });
    }
  };

  const formatAmount = (amount: number) => {
    // Forcer l'affichage dans Chrome en utilisant le formatage explicite
    const num = Number(amount) || 0;
    // Utiliser String() pour forcer la conversion en chaîne
    const formatted = num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true });
    return `${String(formatted)} XAF`;
  };

  const periodLabels = {
    daily: 'Jour',
    weekly: 'Semaine',
    monthly: 'Mois'
  };

  // Générer les jours du calendrier
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: Array<{ day: number; date: Date | null; isCurrentMonth: boolean }> = [];
    
    // Jours du mois précédent
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ day: date.getDate(), date: null, isCurrentMonth: false });
    }
    
    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ day, date, isCurrentMonth: true });
    }
    
    // Remplir jusqu'à 42 cases (6 semaines)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({ day, date: null, isCurrentMonth: false });
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();

  // Obtenir les données pour un jour spécifique
  const getDayData = (date: Date | null) => {
    if (!date) return null;
    const dateStr = date.toLocaleDateString('fr-FR');
    if (activePeriod === 'weekly') {
      return weeklyDailyData.find(d => d.date === dateStr);
    } else if (activePeriod === 'monthly') {
      return monthlyDailyData.find(d => d.date === dateStr);
    }
    return null;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-[#181411] dark:text-white">
      {/* Time Period Selector */}
      <div className="flex px-4 py-3">
        <div className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white dark:bg-background-dark/50 p-1 shadow-sm">
          <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition ${activePeriod === 'daily' ? 'bg-nack-red/20 dark:bg-nack-red/30' : ''}`}>
            <Calendar size={20} className={`mr-2 ${activePeriod === 'daily' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`} />
            <span className={`text-sm font-medium ${activePeriod === 'daily' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`}>
              {periodLabels.daily}
            </span>
            <input
              className="invisible w-0"
              name="period-selector"
              type="radio"
              value="daily"
              checked={activePeriod === 'daily'}
              onChange={() => setActivePeriod('daily')}
            />
          </label>
          <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition ${activePeriod === 'weekly' ? 'bg-nack-red/20 dark:bg-nack-red/30' : ''}`}>
            <Calendar size={20} className={`mr-2 ${activePeriod === 'weekly' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`} />
            <span className={`text-sm font-medium ${activePeriod === 'weekly' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`}>
              {periodLabels.weekly}
            </span>
            <input
              className="invisible w-0"
              name="period-selector"
              type="radio"
              value="weekly"
              checked={activePeriod === 'weekly'}
              onChange={() => setActivePeriod('weekly')}
            />
          </label>
          <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition ${activePeriod === 'monthly' ? 'bg-nack-red/20 dark:bg-nack-red/30' : ''}`}>
            <Calendar size={20} className={`mr-2 ${activePeriod === 'monthly' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`} />
            <span className={`text-sm font-medium ${activePeriod === 'monthly' ? 'text-nack-red' : 'text-[#8a7260] dark:text-gray-400'}`}>
              {periodLabels.monthly}
            </span>
            <input
              className="invisible w-0"
              name="period-selector"
              type="radio"
              value="monthly"
              checked={activePeriod === 'monthly'}
              onChange={() => setActivePeriod('monthly')}
            />
          </label>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-4 pb-24">
        {/* Sales Section */}
        <section className="flex flex-col gap-4 rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-12 rounded-full bg-green-500/20">
              <CreditCard size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-4xl font-bold tracking-tight text-[#181411] dark:text-white force-display">
                {String(formatAmount(current.ventes))}
              </p>
              <p className="text-sm text-muted-foreground" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                {current.commandes} commande{current.commandes > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={20} className="text-green-600" />
              <span className="text-sm text-muted-foreground">Bénéfice</span>
            </div>
            <p className="text-2xl font-bold text-green-600 force-display">
              {String(formatAmount(current.benefice))}
            </p>
          </div>
          <div className="rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={20} className="text-red-600" />
              <span className="text-sm text-muted-foreground">Pertes</span>
            </div>
            <p className="text-2xl font-bold text-red-600 force-display">
              {String(formatAmount(current.pertes))}
            </p>
          </div>
        </div>

        {/* Calendar for Week and Month */}
        {(activePeriod === 'weekly' || activePeriod === 'monthly') && (
          <section className="flex flex-col gap-4 rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">Calendrier</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={previousMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Mois précédent"
                >
                  <ArrowLeft size={20} />
                </button>
                <span className="text-sm font-semibold min-w-[140px] text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Mois suivant"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((item, index) => {
                const dayData = item.date ? getDayData(item.date) : null;
                const hasData = dayData && (dayData.ventes > 0 || dayData.commandes > 0 || dayData.pertes > 0);
                const isToday = item.date && 
                  item.date.toDateString() === new Date().toDateString() &&
                  item.isCurrentMonth;
                
                return (
                  <div
                    key={index}
                    className={`aspect-square p-1 rounded-lg transition ${
                      !item.isCurrentMonth 
                        ? 'opacity-30' 
                        : isToday
                        ? 'bg-nack-red/20 border-2 border-nack-red'
                        : hasData
                        ? 'bg-green-100 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className={`text-xs font-medium ${item.isCurrentMonth ? '' : 'text-muted-foreground'}`}>
                      {item.day}
                    </div>
                    {dayData && item.isCurrentMonth && (
                      <div className="text-[10px] mt-1 space-y-0.5">
                        {dayData.ventes > 0 && (
                          <div className="text-green-600 font-semibold truncate" title={`Ventes: ${formatAmount(dayData.ventes)}`} style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                            {dayData.ventes > 1000 ? `${(dayData.ventes / 1000).toFixed(1)}k` : Number(dayData.ventes).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                        {dayData.commandes > 0 && (
                          <div className="text-blue-600 text-[9px]" title={`${dayData.commandes} commande(s)`}>
                            {dayData.commandes} cmd
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Daily Data List for Week */}
        {activePeriod === 'weekly' && weeklyDailyData.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
            <h3 className="text-lg font-bold mb-2">Détails par jour (7 derniers jours)</h3>
            <div className="space-y-2">
              {weeklyDailyData.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex-1">
                    <p className="font-semibold">{day.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.commandes} commande{day.commandes > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 force-display">
                      {String(formatAmount(day.ventes))}
                    </p>
                    {day.pertes > 0 && (
                      <p className="text-xs text-red-600 force-display">
                        -{String(formatAmount(day.pertes))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Daily Data List for Month */}
        {activePeriod === 'monthly' && monthlyDailyData.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
            <h3 className="text-lg font-bold mb-2">Détails par jour (mois actuel)</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {monthlyDailyData.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex-1">
                    <p className="font-semibold">{day.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.commandes} commande{day.commandes > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 force-display">
                      {String(formatAmount(day.ventes))}
                    </p>
                    {day.pertes > 0 && (
                      <p className="text-xs text-red-600 force-display">
                        -{String(formatAmount(day.pertes))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Popular Products Section */}
        <section className="flex flex-col gap-3 rounded-xl bg-white dark:bg-background-dark/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-yellow-500/20">
                <Star size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#181411] dark:text-white">Produits populaires</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex flex-col items-center gap-2">
                <div className="relative w-full">
                  {product.imageUrl ? (
                    <img
                      className="w-full aspect-square object-contain rounded-xl bg-gray-50 dark:bg-gray-800 p-2"
                      alt={product.name}
                      src={product.imageUrl}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full aspect-square bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-xl flex items-center justify-center p-2 ${product.imageUrl ? 'hidden' : ''}`}>
                    <span className="text-3xl font-bold text-primary">{product.name.charAt(0)}</span>
                  </div>
                  {index === 0 && (
                    <div className="absolute -top-2 -right-2 flex items-center justify-center size-8 rounded-full bg-yellow-400 border-2 border-white dark:border-background-dark/50 shadow">
                      <Star size={16} className="text-white" fill="white" />
                    </div>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="text-sm font-semibold truncate">{product.name}</p>
                  {product.category && (
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  )}
                  <p className="text-xs text-muted-foreground force-display">
                    {String(formatAmount(product.total))}
                  </p>
                  <p className="text-xs text-muted-foreground">x{product.qty}</p>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-muted-foreground">Aucun produit vendu dans la période</p>
              </div>
            )}
          </div>
        </section>

        {/* Export buttons */}
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('csv')}>
            <Download size={16} />
            Exporter CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('pdf')}>
            <Download size={16} />
            Exporter PDF
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
