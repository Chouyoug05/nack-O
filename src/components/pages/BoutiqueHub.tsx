import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
  Package, Plus, ClipboardList, Tag, Tags, Building2, Grid3x3, Barcode,
  Upload, Download, Image, Package as PackageIcon, ArrowDown, ArrowUp, History,
  Clipboard, AlertTriangle, Truck, ShoppingCart, RotateCcw, FileText,
  Users, Heart, Award, DollarSign, CreditCard, MapPin,
  Percent, Zap, Gift, Share2, MessageCircle, TrendingUp, Star,
  UserCheck, Settings, BarChart3, QrCode, Search,
  Eye, Megaphone
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface FeatureCard {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  section: string;
  status: 'active' | 'new' | 'soon';
  route?: string;
  action?: string;
}

const boutiqueFeatures: FeatureCard[] = [
  // PRODUITS
  { id: "add-product", icon: Plus, label: "Ajouter", description: "Nouveau produit", section: "Produits", status: "active", action: "stock" },
  { id: "list-products", icon: ClipboardList, label: "Liste", description: "Tous les produits", section: "Produits", status: "active", action: "stock" },
  { id: "categories", icon: Tag, label: "Catégories", description: "Gérer les catégories", section: "Produits", status: "active", action: "stock" },
  { id: "subcategories", icon: Tags, label: "Sous-catégories", description: "Affiner le classement", section: "Produits", status: "new", action: "stock" },
  { id: "brands", icon: Building2, label: "Marques", description: "Gérer les marques", section: "Produits", status: "soon" },
  { id: "variants", icon: Grid3x3, label: "Variantes", description: "Tailles, couleurs...", section: "Produits", status: "soon" },
  { id: "sku", icon: Barcode, label: "SKU", description: "Références produits", section: "Produits", status: "new", action: "stock" },
  { id: "import", icon: Upload, label: "Import", description: "Excel / CSV", section: "Produits", status: "active", action: "stock" },
  { id: "export", icon: Download, label: "Export", description: "Excel / CSV", section: "Produits", status: "new", action: "stock" },
  { id: "media", icon: Image, label: "Médias", description: "Photos & vidéo", section: "Produits", status: "active", action: "stock" },
  // STOCK
  { id: "stock-status", icon: PackageIcon, label: "État du stock", description: "Vue d'ensemble", section: "Stock", status: "active", action: "stock" },
  { id: "stock-in", icon: ArrowDown, label: "Entrée", description: "Réapprovisionner", section: "Stock", status: "new", action: "stock" },
  { id: "stock-out", icon: ArrowUp, label: "Sortie", description: "Vente / Perte", section: "Stock", status: "new", action: "stock" },
  { id: "movements", icon: History, label: "Mouvements", description: "Historique stock", section: "Stock", status: "soon" },
  { id: "alerts", icon: AlertTriangle, label: "Alertes", description: "Stock faible / rupture", section: "Stock", status: "active", action: "stock" },
  { id: "suppliers", icon: Truck, label: "Fournisseurs", description: "Gérer les fournisseurs", section: "Stock", status: "soon" },
  { id: "inventory", icon: Clipboard, label: "Inventaire", description: "Compter le stock", section: "Stock", status: "soon" },
  // VENTES
  { id: "new-sale", icon: ShoppingCart, label: "Nouvelle vente", description: "Enregistrer une vente", section: "Ventes & Commandes", status: "active", action: "sales" },
  { id: "orders-list", icon: ClipboardList, label: "Commandes", description: "En cours & historique", section: "Ventes & Commandes", status: "active", action: "sales" },
  { id: "returns", icon: RotateCcw, label: "Retours", description: "Échanges & remboursements", section: "Ventes & Commandes", status: "soon" },
  { id: "invoices", icon: FileText, label: "Factures", description: "Imprimer / Télécharger", section: "Ventes & Commandes", status: "active", action: "sales" },
  // CLIENTS
  { id: "customers", icon: Users, label: "Fiches clients", description: "Gérer les clients", section: "Clients", status: "active", action: "customers" },
  { id: "loyalty", icon: Heart, label: "Fidélité", description: "Points & récompenses", section: "Clients", status: "active", action: "customers" },
  { id: "vip", icon: Award, label: "VIP", description: "Clients spéciaux", section: "Clients", status: "active", action: "customers" },
  // PAIEMENTS
  { id: "cash", icon: DollarSign, label: "Espèces", description: "Paiement comptant", section: "Paiements", status: "active", action: "sales" },
  { id: "mobile-money", icon: SmartphoneIcon, label: "Mobile Money", description: "Airtel / Orange / MTN", section: "Paiements", status: "active", action: "sales" },
  { id: "card", icon: CreditCard, label: "Carte", description: "Carte bancaire", section: "Paiements", status: "active", action: "sales" },
  // LIVRAISON
  { id: "delivery-zones", icon: MapPin, label: "Zones", description: "Zones de livraison", section: "Livraison", status: "soon" },
  { id: "delivery-pricing", icon: DollarSign, label: "Tarifs", description: "Prix de livraison", section: "Livraison", status: "active", action: "profile" },
  { id: "delivery-tracking", icon: Truck, label: "Suivi", description: "Suivre les livraisons", section: "Livraison", status: "soon" },
  // PROMOTIONS
  { id: "promos", icon: Percent, label: "Promotions", description: "Réductions & offres", section: "Promotions & Marketing", status: "soon" },
  { id: "coupons", icon: Gift, label: "Codes promo", description: "Coupons de réduction", section: "Promotions & Marketing", status: "soon" },
  { id: "social", icon: Share2, label: "Réseaux", description: "Partager sur les réseaux", section: "Promotions & Marketing", status: "soon" },
  { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", description: "Marketing WhatsApp", section: "Promotions & Marketing", status: "soon" },
  // BOUTIQUE EN LIGNE
  { id: "qr-code", icon: QrCode, label: "QR Code", description: "Lien vers votre catalogue", section: "Boutique en ligne", status: "active", action: "bar-connectee" },
  { id: "catalog", icon: Eye, label: "Catalogue", description: "Voir comme un client", section: "Boutique en ligne", status: "active", action: "bar-connectee" },
  { id: "reviews", icon: Star, label: "Avis clients", description: "Notation & commentaires", section: "Boutique en ligne", status: "soon" },
  // ÉQUIPE
  { id: "staff", icon: UserCheck, label: "Employés", description: "Gérer l'équipe", section: "Équipe", status: "active", route: "/team" },
  { id: "roles", icon: Settings, label: "Rôles", description: "Permissions", section: "Équipe", status: "active", route: "/team" },
  // STATISTIQUES
  { id: "stats", icon: TrendingUp, label: "Statistiques", description: "Ventes & bénéfices", section: "Statistiques", status: "active", action: "reports" },
  { id: "top-products", icon: Star, label: "Top ventes", description: "Produits les + vendus", section: "Statistiques", status: "active", action: "reports" },
  { id: "low-products", icon: TrendingDown, label: "Moins vendus", description: "Produits à écouler", section: "Statistiques", status: "active", action: "reports" },
];

function TrendingDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function SmartphoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

const sectionIcons: Record<string, LucideIcon> = {
  "Produits": Package,
  "Stock": PackageIcon,
  "Ventes & Commandes": ShoppingCart,
  "Clients": Users,
  "Paiements": CreditCard,
  "Livraison": MapPin,
  "Promotions & Marketing": Megaphone,
  "Boutique en ligne": QrCode,
  "Équipe": UserCheck,
  "Statistiques": BarChart3,
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  new: "bg-blue-100 text-blue-700 border-blue-200",
  soon: "bg-gray-100 text-gray-500 border-gray-200",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  new: "Nouveau",
  soon: "Bientôt",
};

interface BoutiqueHubProps {
  onNavigate: (action: string) => void;
}

export default function BoutiqueHub({ onNavigate }: BoutiqueHubProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const sections = [...new Set(boutiqueFeatures.map(f => f.section))];

  const handleFeatureClick = (feature: FeatureCard) => {
    if (feature.status === "soon") {
      toast({
        title: "En cours de développement",
        description: `"${feature.label}" sera bientôt disponible`,
      });
      return;
    }
    if (feature.route) {
      navigate(feature.route);
      return;
    }
    if (feature.action) {
      onNavigate(feature.action);
      return;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">
          {profile?.establishmentName || "Boutique"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Gérez votre boutique en quelques clics
        </p>
      </div>

      {sections.map((section) => {
        const features = boutiqueFeatures.filter(f => f.section === section);
        const SectionIcon = sectionIcons[section] || Package;

        return (
          <Card key={section} className="shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <SectionIcon className="w-5 h-5 text-primary" />
                {section}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {features.map((feature) => (
                  <button
                    key={feature.id}
                    onClick={() => handleFeatureClick(feature)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all relative
                      ${feature.status === "soon"
                        ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                        : feature.status === "new"
                        ? "border-blue-200 bg-blue-50 hover:bg-blue-100 hover:shadow-md active:scale-95"
                        : "border-gray-200 bg-white hover:bg-gray-50 hover:shadow-md active:scale-95"
                      }`}
                  >
                    <feature.icon className={`w-7 h-7 ${
                      feature.status === "soon" ? "text-gray-400" :
                      feature.status === "new" ? "text-blue-600" :
                      "text-gray-700"
                    }`} />
                    <span className={`text-sm font-semibold text-center leading-tight ${
                      feature.status === "soon" ? "text-gray-400" : "text-gray-800"
                    }`}>
                      {feature.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {feature.description}
                    </span>
                    {feature.status !== "active" && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-auto border ${statusColors[feature.status]}`}>
                        {statusLabels[feature.status]}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center pb-4">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Nouveau
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-300" />
          Bientôt disponible
        </span>
      </div>
    </div>
  );
}
