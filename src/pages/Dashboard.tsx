import { useState, useEffect, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import NackLogo from "@/components/NackLogo";
import { 
  ShoppingCart,
  Package,
  BarChart3, 
  LogOut,
  User2,
  ChevronLeft,
  Bell,
  QrCode,
  Calendar,
  Heart,
} from "lucide-react";
import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SalesPage from "@/components/pages/SalesPage";
import StockPage from "@/components/pages/StockPage";
import ReportsPage from "@/components/pages/ReportsPage";
import SettingsPage from "@/components/pages/SettingsPage";
import OrderManagement from "@/components/OrderManagement";
import BarConnecteePage from "@/components/pages/BarConnecteePage";
import EventsPage from "@/components/pages/EventsPage";
import CustomersPage from "@/components/pages/CustomersPage";
import NotificationPanel from "@/components/NotificationPanel";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import TeamPage from "@/components/pages/TeamPage";
import { db } from "@/lib/firebase";
import { productsColRef, salesColRef, teamColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, where, collection } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type StatCard = {
  label: string;
  value: string;
  sublabel?: string;
};

const fallbackStats: StatCard[] = [
  {
    label: "Vente du jour",
    value: "1 250 000 XAF",
  },
  {
    label: "Produits en stock",
    value: "342",
  },
  {
    label: "Équipe active",
    value: "3",
  },
];

type ActionKey = "sales" | "stock" | "reports" | "profile" | "team" | "bar-connectee" | "events" | "customers";

type MenuCard = {
  key: ActionKey | "logout";
  title: string;
  description: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  hint?: string;
  accentBg: string;
  accentColor: string;
};

const menuCards: MenuCard[] = [
  {
    key: "stock",
    title: "Stock",
    description: "",
    icon: Package,
    hint: "",
    accentBg: "",
    accentColor: "text-[#6F42C1]",
  },
  {
    key: "sales",
    title: "Vente",
    description: "",
    icon: ShoppingCart,
    hint: "",
    accentBg: "",
    accentColor: "text-[#28A745]",
  },
  {
    key: "reports",
    title: "Rapport",
    description: "",
    icon: BarChart3,
    hint: "",
    accentBg: "",
    accentColor: "text-[#0D6EFD]",
  },
  {
    key: "team",
    title: "Équipe",
    description: "",
    icon: Users,
    hint: "Gérer",
    accentBg: "",
    accentColor: "text-[#0D6EFD]",
  },
  {
    key: "bar-connectee",
    title: "Bar Connectée",
    description: "",
    icon: QrCode,
    hint: "QR",
    accentBg: "",
    accentColor: "text-[#FD7E14]",
  },
  {
    key: "events",
    title: "Événements",
    description: "",
    icon: Calendar,
    hint: "",
    accentBg: "",
    accentColor: "text-[#E91E63]",
  },
  {
    key: "customers",
    title: "Clients",
    description: "Favoris & Fidélité",
    icon: Heart,
    hint: "",
    accentBg: "",
    accentColor: "text-[#FF6B9D]",
  },
  {
    key: "profile",
    title: "Mon Profil",
    description: "",
    icon: User2,
    hint: "",
    accentBg: "",
    accentColor: "text-[#6C757D]",
  },
  {
    key: "logout",
    title: "Déconnexion",
    description: "",
    icon: LogOut,
    hint: "",
    accentBg: "",
    accentColor: "text-[#DC3545]",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { logout, user, profile } = useAuth();
  const [activeAction, setActiveAction] = useState<ActionKey | "menu">("menu");
  const [statsValues, setStatsValues] = useState({
    salesToday: 0,
    productsCount: 0,
    teamCount: 0,
  });
  const [barPendingCount, setBarPendingCount] = useState<number>(0);
  const [foodProducts, setFoodProducts] = useState<Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    foodCost?: {
      rawMaterials: Array<{ name: string; unitCost: number }>;
      productionCosts: Array<{ type: string; amount: number }>;
    };
  }>>([]);

  useEffect(() => {
    if (!user) return;
    const unsubs: Array<() => void> = [];

    // Products count
    unsubs.push(onSnapshot(
      productsColRef(db, user.uid), 
      (snap) => {
        setStatsValues((prev) => ({ ...prev, productsCount: snap.size }));
      }
    ));

    // Team count
    unsubs.push(onSnapshot(
      teamColRef(db, user.uid), 
      (snap) => {
        setStatsValues((prev) => ({ ...prev, teamCount: snap.size }));
      }
    ));

    // Sales today
    const q = query(salesColRef(db, user.uid), orderBy("createdAt", "desc"));
    unsubs.push(onSnapshot(
      q, 
      (snap) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const dayStart = start.getTime();
        let total = 0;
        snap.forEach((doc) => {
          const d = doc.data() as { createdAt?: number; total?: number; };
          if (typeof d.createdAt === 'number' && d.createdAt >= dayStart) {
            total += Number(d.total || 0);
          }
        });
        setStatsValues((prev) => ({ ...prev, salesToday: total }));
      }
    ));

    // Bar Connectée pending orders count
    try {
      const barOrdersRef = collection(db, `profiles/${user.uid}/barOrders`);
      const pendingQ = query(barOrdersRef, where('status', '==', 'pending'));
      unsubs.push(onSnapshot(pendingQ, (snap) => setBarPendingCount(snap.size)));
    } catch {
      setBarPendingCount(0);
    }

    // Food products with Food Cost
    const foodCategories = ["Plat / Repas", "Snack", "Dessert", "Entrée"];
    unsubs.push(onSnapshot(
      productsColRef(db, user.uid),
      (snap) => {
        const foodItems = snap.docs
          .map(d => {
            const data = d.data();
            const category = data.category || "";
            if (foodCategories.includes(category) && data.foodCost) {
              return {
                id: d.id,
                name: data.name || "",
                category,
                price: Number(data.price || 0),
                foodCost: data.foodCost as {
                  rawMaterials: Array<{ name: string; unitCost: number }>;
                  productionCosts: Array<{ type: string; amount: number }>;
                }
              };
            }
            return null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
        setFoodProducts(foodItems);
      }
    ));

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user]);

  const stats: StatCard[] = [
    {
      label: "Vente du jour",
      value: `${statsValues.salesToday.toLocaleString()} XAF`,
    },
    {
      label: "Produits en stock",
      value: String(statsValues.productsCount),
    },
    {
      label: "Équipe active",
      value: String(statsValues.teamCount),
    },
  ];

  const handleCardClick = async (key: MenuCard["key"]) => {
    if (key === "logout") {
    await logout();
    navigate("/login");
      return;
    }
    if (key === "team") {
      navigate("/team");
      return;
    }
    setActiveAction(key);
  };

  const currentAction =
    activeAction === "menu"
      ? undefined
      : menuCards.find((card) => card.key === activeAction) ?? menuCards[0];

  const renderAction = (action: ActionKey) => {
    switch (action) {
      case "sales":
        return (
          <FeatureGate feature="sales">
            <SalesPage />
          </FeatureGate>
        );
      case "bar-connectee":
        return (
          <FeatureGate feature="barConnectee">
            <BarConnecteePage />
          </FeatureGate>
        );
      case "stock":
        return (
          <FeatureGate feature="stock">
            <StockPage />
          </FeatureGate>
        );
      case "reports":
        return (
          <FeatureGate feature="reports">
            <ReportsPage />
          </FeatureGate>
        );
      case "events":
        return (
          <FeatureGate feature="events">
            <EventsPage />
          </FeatureGate>
        );
      case "customers":
        return <CustomersPage />;
      case "profile":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#f6f8f6]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f6]/80 p-4 md:p-6 pb-2 backdrop-blur-sm border-b border-gray-200/50">
        {activeAction !== "menu" && (
          <button
            type="button"
            onClick={() => setActiveAction("menu")}
            className="flex items-center gap-1 rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} className="md:w-6 md:h-6" />
          </button>
        )}
        {activeAction === "menu" && <div className="w-8 md:w-12"></div>}
        {activeAction === "menu" ? (
          <div className="flex items-center gap-2 md:gap-3">
            {profile?.logoUrl ? (
              <>
                <img
                  src={profile.logoUrl}
                  alt="Logo"
                  className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = 'inline-block';
                  }}
                />
                <span className="hidden">
                  <NackLogo size="sm" />
                </span>
              </>
            ) : (
              <NackLogo size="sm" />
            )}
            <span className="text-sm md:text-base lg:text-lg font-semibold text-gray-900 truncate max-w-[40vw] md:max-w-none">
              {profile?.establishmentName || "Mon Établissement"}
            </span>
          </div>
        ) : (
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight tracking-[-0.015em] text-gray-900">
            {currentAction.title}
          </h1>
        )}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <NotificationPanel size="sm" onNavigateToOrders={() => handleCardClick("bar-connectee")} />
            {barPendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4 md:h-5 px-1 rounded-full bg-red-600 text-white text-[10px] md:text-xs font-bold flex items-center justify-center">
                {barPendingCount}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Compte utilisateur"
                className="rounded-full hover:opacity-90 focus:outline-none transition-opacity"
              >
                <Avatar className="h-9 w-9 md:h-11 md:w-11 lg:h-12 lg:w-12">
                  <AvatarImage src={(user as { photoURL?: string } | null)?.photoURL || (profile as { logoUrl?: string } | null)?.logoUrl || ""} alt="Avatar" />
                  <AvatarFallback>
                    {(() => {
                      const name = (profile as { establishmentName?: string } | null)?.establishmentName || (user as { email?: string } | null)?.email || "U";
                      return name.charAt(0).toUpperCase();
                    })()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 md:w-56">
              {profile?.establishmentName && (
                <div className="px-2 py-1.5 text-xs md:text-sm text-muted-foreground truncate" title={profile.establishmentName}>
                  {profile.establishmentName}
                </div>
              )}
              <DropdownMenuItem onClick={() => setActiveAction("profile")}>Mon Profil</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Section */}
      {activeAction === "menu" && (
        <section className="p-4 md:p-6 lg:p-8 pt-4 md:pt-6 lg:pt-8">
          <div className="w-full">
            <div className="grid grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
              {stats.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center rounded-xl md:rounded-2xl border border-gray-200 bg-white p-3 md:p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-xs md:text-sm lg:text-base font-medium text-gray-500 mb-1 md:mb-2">{label}</p>
                  <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Rentabilité des plats */}
      {activeAction === "menu" && foodProducts.length > 0 && (
        <section className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4 lg:pt-6">
          <div className="w-full max-w-7xl mx-auto">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Rentabilité des plats</CardTitle>
                <CardDescription>Analyse des coûts et marges des produits alimentaires</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom du plat</TableHead>
                        <TableHead>Coût total</TableHead>
                        <TableHead>Prix de vente</TableHead>
                        <TableHead>Food cost %</TableHead>
                        <TableHead>Marge</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {foodProducts.map((product) => {
                        const rawMaterialsTotal = product.foodCost?.rawMaterials.reduce((sum, m) => sum + m.unitCost, 0) || 0;
                        const productionCostsTotal = product.foodCost?.productionCosts.reduce((sum, c) => sum + c.amount, 0) || 0;
                        const totalCost = rawMaterialsTotal + productionCostsTotal;
                        const sellingPrice = product.price || 0;
                        const grossMargin = sellingPrice - totalCost;
                        const foodCostPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
                        const marginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;
                        const isProfitable = grossMargin > 0 && foodCostPercent <= 40;
                        
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{totalCost.toLocaleString()} XAF</TableCell>
                            <TableCell>{sellingPrice.toLocaleString()} XAF</TableCell>
                            <TableCell>
                              <span className={foodCostPercent <= 30 ? 'text-green-600 font-semibold' : foodCostPercent <= 40 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {foodCostPercent.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={grossMargin >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {grossMargin.toLocaleString()} XAF ({marginPercent.toFixed(1)}%)
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={isProfitable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {isProfitable ? 'Rentable' : 'Non rentable'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Main Actions */}
      {activeAction === "menu" ? (
        <main className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4 lg:pt-6 flex-1">
          <div className="w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
              {menuCards.map(({ key, title, icon: Icon, hint, accentColor }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleCardClick(key)}
                  className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <Icon size={40} className={`md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 ${accentColor} transition-transform group-hover:scale-110`} />
                  <div className="flex flex-col text-center">
                    <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                      {title}
                    </h2>
                    {hint && (
                      <p className={`text-sm md:text-base font-normal leading-normal mt-1 ${accentColor}`}>
                        {hint}
                      </p>
                    )}
                  </div>
                  {key === 'bar-connectee' && barPendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 min-w-[20px] h-5 md:h-6 px-1.5 md:px-2 rounded-full bg-red-600 text-white text-xs md:text-sm font-bold flex items-center justify-center shadow-lg">
                      {barPendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">
          <div className="flex-1 overflow-y-auto w-full">
            {renderAction(currentAction.key as ActionKey)}
          </div>
        </main>
      )}
    </div>
  );
};

export default Dashboard;

