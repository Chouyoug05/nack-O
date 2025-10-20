import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign, 
  TrendingUp,
  Settings,
  Menu,
  Calendar,
  LogOut,
  Shield,
  Target,
  QrCode
} from "lucide-react";
import NackLogo from "@/components/NackLogo";
import MobileBottomNav from "@/components/MobileBottomNav";
import TabletSidebar from "@/components/TabletSidebar";
import OrderManagement from "@/components/OrderManagement";
import NotificationPanel from "@/components/NotificationPanel";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StockPage from "@/components/pages/StockPage";
import SalesPage from "@/components/pages/SalesPage";
import EventsPage from "@/components/pages/EventsPage";
import SettingsPage from "@/components/pages/SettingsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import TeamPage from "@/components/pages/TeamPage";
import BarConnecteePage from "@/components/pages/BarConnecteePage";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { productsColRef, salesColRef, teamColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { setDoc, doc } from "firebase/firestore";
import { agentTokensTopColRef } from "@/lib/collections";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import WhatsAppPopup from "@/components/WhatsAppPopup";
import TutorialDialog from "@/components/TutorialDialog";
import TutorialBlocker from "@/components/TutorialBlocker";
import WhatsAppCommunityPopup from "@/components/WhatsAppCommunityPopup";
import { useTutorialProgress } from "@/hooks/useTutorialProgress";

const getManagerOutboxKey = (uid: string) => `nack_m_outbox_${uid}`;
const getAgentOutboxPrefix = (uid: string) => `nack_order_outbox_${uid}_`;

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { profile, logout, user } = useAuth();

  const initials = (profile?.ownerName || profile?.email || "").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "NA";
  const establishmentName = profile?.establishmentName || "Mon Établissement";
  const ownerName = profile?.ownerName || profile?.email || "Utilisateur";
  const logoUrl = profile?.logoUrl;

  const [statsValues, setStatsValues] = useState({
    salesToday: 0,
    ordersToday: 0,
    productsCount: 0,
    teamCount: 0,
  });
  const [recentSales, setRecentSales] = useState<Array<{ id: string; items: { name: string; quantity: number; }[]; total: number; createdAt: number }>>([]);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [barConnecteeActiveTab, setBarConnecteeActiveTab] = useState<string>("qr-code");

  // Hook pour suivre le progrès du tutoriel
  useTutorialProgress();

  const handleStartTutorial = () => {
    setShowTutorial(true);
  };

  useEffect(() => {
    if (profile && !profile.whatsapp) {
      setShowWhatsAppPopup(true);
    }
  }, [profile]);

  // Écouter les événements de changement d'onglet depuis les pages
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const data = event.detail;
      if (typeof data === 'string' && data === 'bar-connectee') {
        setActiveTab('bar-connectee');
      } else if (typeof data === 'object' && data.tab === 'bar-connectee') {
        setActiveTab('bar-connectee');
        if (data.subTab) {
          setBarConnecteeActiveTab(data.subTab);
        }
      }
    };

    window.addEventListener('nack:tab:change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('nack:tab:change', handleTabChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs: Array<() => void> = [];

    // Products count
    unsubs.push(onSnapshot(
      productsColRef(db, user.uid), 
      (snap) => {
        setStatsValues((prev) => ({ ...prev, productsCount: snap.size }));
      },
      () => {
        setStatsValues((prev) => ({ ...prev, productsCount: prev.productsCount || 0 }));
      }
    ));

    // Team count
    unsubs.push(onSnapshot(
      teamColRef(db, user.uid), 
      (snap) => {
        setStatsValues((prev) => ({ ...prev, teamCount: snap.size }));
        // Backfill public agentTokens mapping for existing members to enable agent token login
        (async () => {
          try {
            for (const d of snap.docs) {
              const data = d.data() as { agentToken?: string; agentCode?: string; firstName?: string; lastName?: string; role?: string };
              if (data.agentToken) {
                await setDoc(doc(agentTokensTopColRef(db), data.agentToken), {
                  ownerUid: user.uid,
                  agentCode: data.agentCode,
                  firstName: data.firstName,
                  lastName: data.lastName,
                  role: data.role,
                  updatedAt: Date.now(),
                }, { merge: true });
              }
            }
          } catch {
            // ignore
          }
        })();
      },
      () => {
        setStatsValues((prev) => ({ ...prev, teamCount: prev.teamCount || 0 }));
      }
    ));

    // Sales today (sum and count) + recent activity
    const q = query(salesColRef(db, user.uid), orderBy("createdAt", "desc"));
    unsubs.push(onSnapshot(
      q, 
      (snap) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const dayStart = start.getTime();
        let total = 0;
        let count = 0;
        const latest: Array<{ id: string; items: { name: string; quantity: number; }[]; total: number; createdAt: number }> = [];
        snap.forEach((doc) => {
          const d = doc.data() as { createdAt?: number; total?: number; items?: Array<{ name: string; quantity: number }>; };
          if (typeof d.createdAt === 'number' && d.createdAt >= dayStart) {
            total += Number(d.total || 0);
            count += 1;
          }
          latest.push({ id: doc.id, items: d.items || [], total: Number(d.total || 0), createdAt: Number(d.createdAt || 0) });
        });
        setStatsValues((prev) => ({ ...prev, salesToday: total, ordersToday: count }));
        setRecentSales(latest.slice(0, 5));
      },
      () => {
        // Keep previous values on error
        setStatsValues((prev) => ({ ...prev }));
        setRecentSales((prev) => prev);
      }
    ));

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user]);

  useEffect(() => {
    const updateQueue = () => {
      if (!user) { setQueueCount(0); return; }
      try {
        let total = 0;
        // Manager outbox
        const mRaw = localStorage.getItem(getManagerOutboxKey(user.uid));
        if (mRaw) {
          const list = JSON.parse(mRaw) as unknown[];
          if (Array.isArray(list)) total += list.length;
        }
        // Agent outboxes on this device for this owner uid
        const prefix = getAgentOutboxPrefix(user.uid);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (key.startsWith(prefix)) {
            try {
              const raw = localStorage.getItem(key);
              const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
              if (Array.isArray(arr)) total += arr.length;
            } catch { /* ignore */ }
          }
        }
        setQueueCount(total);
      } catch { setQueueCount(0); }
    };
    updateQueue();
    const onOnline = () => { setIsOnline(true); updateQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(updateQueue, 4000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.clearInterval(interval); };
  }, [user]);

  const stats = useMemo(() => ([
    {
      title: "Ventes du jour",
      value: `${statsValues.salesToday.toLocaleString()} XAF`,
      change: "—",
      icon: DollarSign,
      trend: "up"
    },
    {
      title: "Commandes",
      value: String(statsValues.ordersToday),
      change: "—",
      icon: ShoppingCart,
      trend: "up"
    },
    {
      title: "Produits en stock",
      value: String(statsValues.productsCount),
      change: "—",
      icon: Package,
      trend: "up"
    },
    {
      title: "Équipe active",
      value: String(statsValues.teamCount),
      change: "—",
      icon: Users,
      trend: "up"
    }
  ]), [statsValues]);

  const quickActions = [
    {
      title: "Gestion du Stock",
      description: "Ajouter/modifier produits",
      icon: Package,
      color: "bg-blue-500",
      action: () => handleTabChange("stock")
    },
    {
      title: "Nouvelle Vente",
      description: "Enregistrer une transaction",
      icon: ShoppingCart,
      color: "bg-green-500",
      action: () => handleTabChange("sales")
    },
    {
      title: "Rapports",
      description: "Voir les statistiques",
      icon: BarChart3,
      color: "bg-purple-500",
      action: () => handleTabChange("reports")
    },
    {
      title: "Équipe",
      description: "Gérer l'équipe",
      icon: Users,
      color: "bg-orange-500",
      action: () => handleTabChange("equipe")
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'evenements') {
      alert('La fonctionnalité Événements sera disponible en décembre.\n\nPréparez vos événements (produits, tarifs, affiches).\nBilletterie en ligne et validation QR seront disponibles à cette date.');
      return;
    }
    // Avancer automatiquement le tutoriel lorsqu'on ouvre Ventes / Rapports
    try {
      if (tab === 'sales') {
        // Ouvre la page ventes et laisse le hook détecter la première vente
        // Rien à faire ici, juste ouvrir
      } else if (tab === 'reports') {
        // Encourage l'utilisateur à exporter un rapport
        setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('nack:tutorial:hint', { detail: { page: 'reports' } }));
          } catch {
            // Ignore dispatch errors
          }
        }, 500);
      }
    } catch {
      // Ignore tutorial navigation errors
    }
    setActiveTab(tab);
    setSidebarOpen(false); // Close mobile sidebar when changing tabs
  };

  const handleTutorialStepComplete = (step: string) => {
    if (step === 'completed') {
      setShowTutorial(false);
    }
  };


  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Mobile Header - Simple header for mobile without burger menu */}
      <div className="md:hidden bg-card border-b px-4 py-3 flex items-center justify-center relative flex-shrink-0">
        <NackLogo size="sm" />
        <div className="absolute right-4 flex items-center gap-2">

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTabChange("evenements")}
            className="relative hover:bg-nack-beige-light"
          >
            <Calendar className="h-5 w-5" />
          </Button>
          <NotificationPanel size="sm" onNavigateToOrders={() => handleTabChange("sales")} />
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
            <button
              className="rounded-full overflow-hidden w-8 h-8 flex items-center justify-center bg-gradient-primary text-white font-bold"
              aria-label="Profil"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs">{initials}</span>
              )}
            </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleStartTutorial}>
                  <Target className="mr-2 h-4 w-4" /> Tutoriel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("bar-connectee")}>
                  <QrCode className="mr-2 h-4 w-4" /> Bar Connectée
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("settings")}>
                  <Settings className="mr-2 h-4 w-4" /> Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Dot statut sur avatar: vert si OK, rouge si offline ou sync en attente */}
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${(!isOnline || queueCount > 0) ? 'bg-red-600' : 'bg-green-600'}`}></span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tablet Sidebar - visible on tablet only */}
        <TabletSidebar 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
        />

        {/* Desktop Sidebar - visible on desktop only */}
        <div className="hidden lg:flex flex-col w-64 bg-card border-r border-border flex-shrink-0">
          {/* Logo */}
          <div className="p-6 border-b border-border flex-shrink-0">
            <NackLogo size="md" />
            <p className="text-sm text-muted-foreground mt-1">{establishmentName}</p>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Button 
              variant={activeTab === "dashboard" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("dashboard")}
            >
              <BarChart3 className="mr-3" size={18} />
              Tableau de bord
            </Button>
            <Button 
              variant={activeTab === "stock" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("stock")}
            >
              <Package className="mr-3" size={18} />
              Stock
            </Button>
            <Button 
              variant={activeTab === "sales" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("sales")}
            >
              <ShoppingCart className="mr-3" size={18} />
              Ventes
            </Button>
            <Button 
              variant={activeTab === "reports" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("reports")}
            >
              <BarChart3 className="mr-3" size={18} />
              Rapports
            </Button>
            <Button 
              variant={activeTab === "evenements" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("evenements")}
            >
              <Calendar className="mr-3" size={18} />
              Événements
            </Button>
            <Button 
              variant={activeTab === "settings" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("settings")}
            >
              <Settings className="mr-3" size={18} />
              Paramètres
            </Button>
          </div>

          {/* User Section - Fixed at bottom */}
          <div className="p-4 border-t border-border flex-shrink-0 bg-card">
            <div className="bg-nack-beige-light rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-full object-cover shadow-button" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg shadow-button">{initials}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{ownerName}</p>
                  <p className="text-sm text-muted-foreground">Gérant • {establishmentName}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                onClick={handleLogout}
              >
                <LogOut className="mr-2" size={16} />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:block bg-card border-b px-8 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {activeTab === "dashboard" && "Tableau de bord"}
                  {activeTab === "stock" && "Gestion du Stock"}
                  {activeTab === "sales" && "Point de Vente"}
                  {activeTab === "equipe" && "Gestion de l'Équipe"}
                  {activeTab === "reports" && "Rapports & Analyses"}
                  {activeTab === "evenements" && "Gestion des Événements"}
                  {activeTab === "settings" && "Paramètres"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {activeTab === "dashboard" && "Vue d'ensemble de votre établissement"}
                  {activeTab === "stock" && "Gérez vos produits et surveillez les stocks"}
                  {activeTab === "sales" && "Interface de vente et gestion des transactions"}
                  {activeTab === "equipe" && "Gérez votre équipe de serveurs et caissiers"}
                  {activeTab === "reports" && "Analysez les performances et suivez les tendances"}
                  {activeTab === "evenements" && "Créez et gérez vos événements avec vente de billets"}
                  {activeTab === "settings" && "Configurez votre établissement et vos préférences"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabChange("evenements")}
                  className="relative hover:bg-nack-beige-light"
                >
                  <Calendar className="h-5 w-5" />
                </Button>
                <div className="hidden md:flex items-center gap-2 text-xs mr-2">
                  <span className={isOnline ? "text-green-600" : "text-red-600"}>{isOnline ? "En ligne" : "Hors ligne"}</span>
                  {queueCount > 0 && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.dispatchEvent(new Event('online'))}>
                      À sync: {queueCount}
                    </Button>
                  )}
                </div>
                <NotificationPanel size="md" onNavigateToOrders={() => handleTabChange("sales")} />
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover shadow-button" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold shadow-button">{initials}</div>
                )}
              </div>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-8 pb-20 md:pb-8">
              {/* Page Content */}
              {activeTab === "dashboard" ? (
                <>
                  {/* Mobile/Tablet Header */}
                  <div className="lg:hidden mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
                    <p className="text-muted-foreground text-sm">Vue d'ensemble de votre établissement</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {stats.map((stat, index) => (
                      <Card key={index} className="shadow-card border-0">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                              <stat.icon size={20} className="text-nack-red" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
                              <p className="text-lg font-bold">{stat.value}</p>
                              <p className={`text-xs flex items-center gap-1 ${
                                stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                <TrendingUp size={12} className={stat.trend === 'down' ? 'rotate-180' : ''} />
                                {stat.change}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-3">Actions rapides</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {quickActions.map((action, index) => (
                        <Card key={index} className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer" onClick={action.action}>
                          <CardContent className="p-4 text-center">
                            <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                              <action.icon size={24} className="text-white" />
                            </div>
                            <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <Card className="shadow-card border-0 mb-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Activité récente</CardTitle>
                      <CardDescription className="text-sm">Dernières transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {recentSales.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                        ) : (
                          recentSales.map((sale) => (
                            <div key={sale.id} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                              <div>
                                <p className="font-medium text-sm">
                                  {sale.items.map(it => `${it.name} x${it.quantity}`).join(', ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(sale.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                              <div className="font-semibold text-sm text-green-600">
                                +{sale.total.toLocaleString()} XAF
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section Commandes reçues masquée temporairement */}
                </>
              ) : (
                <>
                  {/* Page Headers */}
                  <div className="lg:hidden mb-6">
                    <h1 className="text-2xl font-bold text-foreground">
                      {activeTab === "stock" && "Gestion du Stock"}
                      {activeTab === "sales" && "Point de Vente"}
                      {activeTab === "equipe" && "Gestion de l'Équipe"}
                      {activeTab === "reports" && "Rapports & Analyses"}
                      {activeTab === "settings" && "Paramètres"}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {activeTab === "stock" && "Gérez vos produits et surveillez les stocks"}
                      {activeTab === "sales" && "Interface de vente et gestion des transactions"}
                      {activeTab === "equipe" && "Gérez votre équipe de serveurs et caissiers"}
                      {activeTab === "reports" && "Analysez les performances et suivez les tendances"}
                      {activeTab === "settings" && "Configurez votre établissement et vos préférences"}
                    </p>
                  </div>

                  {/* Render Page Components */}
                  {activeTab === "stock" && <StockPage />}
                  {activeTab === "sales" && (
                    <TutorialBlocker feature="sales">
                      <SalesPage />
                    </TutorialBlocker>
                  )}
                  {activeTab === "equipe" && (
                    <TutorialBlocker feature="team">
                      <TeamPage />
                    </TutorialBlocker>
                  )}
                  {activeTab === "evenements" && <EventsPage />}
                  {activeTab === "reports" && (
                    <TutorialBlocker feature="reports">
                      <ReportsPage />
                    </TutorialBlocker>
                  )}
                  {activeTab === "bar-connectee" && (
                    <BarConnecteePage 
                      activeTab={barConnecteeActiveTab} 
                      onTabChange={(tab: string) => setBarConnecteeActiveTab(tab)} 
                    />
                  )}
                  {activeTab === "settings" && (
                    <TutorialBlocker feature="settings">
                      <SettingsPage onTabChange={handleTabChange} />
                    </TutorialBlocker>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* WhatsApp Popup */}
      <WhatsAppPopup 
        open={showWhatsAppPopup}
        onOpenChange={setShowWhatsAppPopup}
      />

      {/* Tutorial Dialog */}
      <TutorialDialog 
        open={showTutorial}
        onOpenChange={setShowTutorial}
        onStepComplete={handleTutorialStepComplete}
      />

      {/* WhatsApp Community Popup */}
      <WhatsAppCommunityPopup />
      </div>
  );
};

export default Dashboard;