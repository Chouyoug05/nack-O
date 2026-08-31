import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  getMenuConfig,
  createMenuConfig,
  updateMenuConfig,
  setMenuEnabled,
  setMenuDesign,
  setDailySpecialMode,
  addTable,
  updateTable,
  deleteTable,
  regenerateTableQrToken,
  getPublicMenuUrl,
  getMenuTables,
} from "@/lib/menuConfig";
import { syncPublicProfile } from "@/lib/publicProfile";
import { productsColRef } from "@/lib/collections";
import { onSnapshot, doc, updateDoc } from "firebase/firestore";
import type { MenuConfig, MenuTable, MenuDesignId } from "@/types/menuConfig";
import { getMenuLabel, isTableType } from "@/constants/establishmentTypes";
import { MENU_DESIGNS } from "@/types/menuConfig";
import QRCode from "qrcode";
import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Input,
} from "@/components/ui/input";
import {
  Label,
} from "@/components/ui/label";
import {
  Switch,
} from "@/components/ui/switch";
import {
  Badge,
} from "@/components/ui/badge";
import {
  Separator,
} from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Eye,
  QrCode,
  Globe,
  Table as TableIcon,
  Palette,
  Settings,
  Check,
  AlertCircle,
  Info,
  ArrowRight,
  Loader2,
  Truck,
  CreditCard,
  Star,
  Flame,
} from "lucide-react";

const DESIGN_PREVIEW: Record<MenuDesignId, { bg: string; card: string; accent: string; text: string; border: string }> = {
  modern: { bg: "#0f172a", card: "#1e293b", accent: "#f43f5e", text: "#e2e8f0", border: "#273449" },
  elegant: { bg: "#f5f0e8", card: "#fffdf8", accent: "#a8824f", text: "#33302b", border: "#e4dac9" },
  minimal: { bg: "#ffffff", card: "#ffffff", accent: "#111111", text: "#141414", border: "#ededed" },
  boutique: { bg: "#f1f5f9", card: "#ffffff", accent: "#2563eb", text: "#0f172a", border: "#e2e8f0" },
  gastronomique: { bg: "#fdf9f3", card: "transparent", accent: "#7c2d12", text: "#2d241c", border: "#e3d3bf" },
};

function DesignMiniPreview({ design }: { design: MenuDesignId }) {
  const p = DESIGN_PREVIEW[design];
  const miniCard = (
    <div
      style={{
        background: p.card,
        border: `1px solid ${p.border}`,
        borderRadius: design === "gastronomique" ? 0 : 4,
        borderBottom: design === "gastronomique" ? `1px dashed ${p.border}` : undefined,
        padding: "5px 6px",
        flex: 1,
      }}
    >
      <div style={{ width: "60%", height: 4, background: p.accent, borderRadius: 2 }} />
      <div style={{ width: "38%", height: 3, background: p.text, opacity: 0.35, borderRadius: 2, marginTop: 4 }} />
    </div>
  );
  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{ background: p.bg, border: `1px solid ${p.border}` }}
    >
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 14, background: p.card, borderBottom: `1px solid ${p.border}` }}
      >
        <div style={{ width: "34%", height: 3.5, background: p.accent, borderRadius: 2 }} />
        <div style={{ width: "16%", height: 5, background: p.accent, opacity: 0.75, borderRadius: 99 }} />
      </div>
      <div className="p-1.5">
        {design === "boutique" ? (
          <div className="flex gap-1.5">{miniCard}{miniCard}</div>
        ) : (
          <div className="space-y-1.5">{miniCard}{miniCard}</div>
        )}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

function copyToClipboard(text: string, toast: ReturnType<typeof useToast>["toast"]) {
  navigator.clipboard.writeText(text).then(
    () => toast({ title: "Copié", description: "Lien copié dans le presse-papiers" }),
    () => toast({ title: "Erreur", description: "Impossible de copier", variant: "destructive" })
  );
}

async function downloadQRCode(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function MenuDigitalPage() {
  const { user, profile, saveProfile } = useAuth();
  const { toast } = useToast();
  const menuLabel = getMenuLabel(profile?.establishmentType);
  const showTables = isTableType(profile?.establishmentType);

  const [config, setConfig] = useState<MenuConfig | null>(null);
  const [tables, setTables] = useState<MenuTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [tableQrCodes, setTableQrCodes] = useState<Record<string, string>>({});
  const [editingTable, setEditingTable] = useState<MenuTable | null>(null);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("");
  const [newTableZone, setNewTableZone] = useState("");
  const [activeTab, setActiveTab] = useState<"config" | "tables">("config");
  const [deliveryEnabled, setDeliveryEnabled] = useState(profile?.deliveryEnabled ?? false);
  const [deliveryPrice, setDeliveryPrice] = useState(profile?.deliveryPrice ?? 0);
  const [dailySpecialMode, setDailySpecialMode] = useState(config?.dailySpecialMode ?? false);
  const [activatableProducts, setActivatableProducts] = useState<Array<{ id: string; name: string; category?: string; isFeatured?: boolean; isDailySpecial?: boolean; isPromotional?: boolean; showInMenu?: boolean }>>([]);

  const uid = user?.uid;

  // ─── Load config & tables ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [cfg, tbls] = await Promise.all([
        getMenuConfig(db, uid),
        getMenuTables(db, uid),
      ]);
      if (!cfg) {
        const created = await createMenuConfig(db, uid, {});
        setConfig(created);
        setDailySpecialMode(created.dailySpecialMode ?? false);
        // Generate QR for new config
        const url = getPublicMenuUrl(created.uid);
        const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
        setQrCodeDataUrl(qr);
      } else {
        setConfig(cfg);
        setDailySpecialMode(cfg.dailySpecialMode ?? false);
        const url = getPublicMenuUrl(cfg.uid);
        const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
        setQrCodeDataUrl(qr);
      }
      setTables(tbls);
      // Generate QR for each table
      for (const t of tbls) {
        const tableUrl = getPublicMenuUrl(uid, t.qrToken);
        const qr = await QRCode.toDataURL(tableUrl, { width: 300, margin: 2 });
        setTableQrCodes((prev) => ({ ...prev, [t.id]: qr }));
      }
    } catch (e) {
      console.error('[MenuDigitalPage] loadData error:', e);
      toast({ title: "Erreur", description: "Impossible de charger la configuration", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [uid, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Load activatable products (vedette/jour) ────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(productsColRef(db, uid), (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(raw.name || ""),
          category: String(raw.category || ""),
          isFeatured: Boolean(raw.isFeatured),
          isDailySpecial: Boolean(raw.isDailySpecial),
          isPromotional: Boolean(raw.isPromotional),
          showInMenu: raw.showInMenu !== false,
        };
      });
      setActivatableProducts(list);
    });
    return () => unsub();
  }, [uid]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!uid || !config || !profile) return;
    setSaving(true);
    try {
      await setMenuEnabled(db, uid, enabled);
      setConfig((c) => c ? { ...c, enabled } : null);
      await syncPublicProfile(db, profile, { menuConfigEnabled: enabled, menuDesignId: config.selectedDesign });
      toast({ title: enabled ? "Activé" : "Désactivé", description: `Le ${menuLabel.toLowerCase()} est maintenant ${enabled ? "accessible" : "masqué"} publiquement` });
    } catch (e) {
      console.error('[MenuDigitalPage] toggle error:', e);
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Impossible de modifier l'état", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDesignChange = async (designId: MenuDesignId) => {
    if (!uid || !config || !profile) return;
    setSaving(true);
    try {
      await setMenuDesign(db, uid, designId);
      setConfig((c) => c ? { ...c, selectedDesign: designId } : null);
      await syncPublicProfile(db, profile, { menuConfigEnabled: config.enabled, menuDesignId: designId });
      toast({ title: "Design mis à jour", description: `Le template "${MENU_DESIGNS.find(d => d.id === designId)?.label}" a été appliqué` });
    } catch (e) {
      console.error('[MenuDigitalPage] design change error:', e);
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Impossible de changer le design", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDailyMode = async (enabled: boolean) => {
    if (!uid || !config || !profile) return;
    setSaving(true);
    try {
      await setDailySpecialMode(db, uid, enabled);
      setDailySpecialMode(enabled);
      setConfig((c) => c ? { ...c, dailySpecialMode: enabled } : null);
      await syncPublicProfile(db, profile, { menuConfigEnabled: config.enabled, menuDesignId: config.selectedDesign, dailySpecialMode: enabled });
      toast({ title: enabled ? "Mode Plat du jour activé" : "Mode Plat du jour désactivé", description: enabled ? "Le menu public n'affichera que les plats du jour et vedettes" : "Tous les produits s'affichent dans le menu public" });
    } catch (e) {
      console.error('[MenuDigitalPage] dailySpecialMode error:', e);
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Impossible de modifier le mode", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductFlag = async (productId: string, flag: "isFeatured" | "isDailySpecial" | "showInMenu", current: boolean) => {
    if (!uid) return;
    try {
      await updateDoc(doc(productsColRef(db, uid), productId), { [flag]: !current, updatedAt: Date.now() });
    } catch (e) {
      console.error('[MenuDigitalPage] product flag error:', e);
      toast({ title: "Erreur", description: "Impossible de modifier le produit", variant: "destructive" });
    }
  };

  const handleAddTable = async () => {
    if (!uid || !newTableNumber.trim()) return;
    setSaving(true);
    try {
      const capacity = newTableCapacity ? parseInt(newTableCapacity, 10) : undefined;
      const table = await addTable(db, uid, newTableNumber.trim(), {
        capacity: capacity && !isNaN(capacity) ? capacity : undefined,
        zone: newTableZone.trim() || undefined,
      });
      setTables((prev) => [...prev, table]);
      const tableUrl = getPublicMenuUrl(uid, table.qrToken);
      const qr = await QRCode.toDataURL(tableUrl, { width: 300, margin: 2 });
      setTableQrCodes((prev) => ({ ...prev, [table.id]: qr }));
      setNewTableNumber("");
      setNewTableCapacity("");
      setNewTableZone("");
      toast({ title: "Table ajoutée", description: `Table "${table.number}" créée avec son QR code` });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible d'ajouter la table", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTable = async () => {
    if (!uid || !editingTable) return;
    setSaving(true);
    try {
      await updateTable(db, uid, editingTable.id, {
        number: newTableNumber.trim(),
        capacity: newTableCapacity ? parseInt(newTableCapacity, 10) : undefined,
        zone: newTableZone.trim() || undefined,
      });
      setTables((prev) => prev.map(t => t.id === editingTable.id ? { ...t, number: newTableNumber.trim(), capacity: newTableCapacity ? parseInt(newTableCapacity, 10) : undefined, zone: newTableZone.trim() || undefined } : t));
      setEditingTable(null);
      setNewTableNumber("");
      setNewTableCapacity("");
      setNewTableZone("");
      toast({ title: "Table mise à jour" });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de modifier la table", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditTable = (table: MenuTable) => {
    setEditingTable(table);
    setNewTableNumber(table.number);
    setNewTableCapacity(table.capacity?.toString() || "");
    setNewTableZone(table.zone || "");
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!uid) return;
    if (!confirm("Supprimer cette table ? Son QR code ne fonctionnera plus.")) return;
    setSaving(true);
    try {
      await deleteTable(db, uid, tableId);
      setTables((prev) => prev.filter(t => t.id !== tableId));
      setTableQrCodes((prev) => { const n = { ...prev }; delete n[tableId]; return n; });
      toast({ title: "Table supprimée" });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de supprimer la table", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateQr = async (table: MenuTable) => {
    if (!uid) return;
    setSaving(true);
    try {
      const newToken = await regenerateTableQrToken(db, uid, table.id);
      const tableUrl = getPublicMenuUrl(uid, newToken);
      const qr = await QRCode.toDataURL(tableUrl, { width: 300, margin: 2 });
      setTableQrCodes((prev) => ({ ...prev, [table.id]: qr }));
      setTables((prev) => prev.map(t => t.id === table.id ? { ...t, qrToken: newToken } : t));
      toast({ title: "QR code régénéré", description: "L'ancien lien ne fonctionne plus" });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de régénérer le QR", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = () => {
    if (!config) return;
    copyToClipboard(shareUrl, toast);
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl || !config) return;
    downloadQRCode(qrCodeDataUrl, `${config.uid}-menu-qr.png`);
  };

  const handleOpenPublicMenu = () => {
    if (!config) return;
    window.open(shareUrl, "_blank");
  };

  const handleSaveDelivery = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await saveProfile({
        deliveryEnabled,
        deliveryPrice,
      });
      toast({ title: "Livraison sauvegardée", description: `Livraison ${deliveryEnabled ? "activée" : "désactivée"}${deliveryEnabled ? ` (${deliveryPrice} XAF)` : ""}` });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les paramètres de livraison", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-nack-red" />
      </div>
    );
  }

  const publicUrl = config ? getPublicMenuUrl(config.uid) : "";
  // En dev local : lien/aperçu pointent vers le light app local (nack.pro n'a le code à jour qu'après déploiement)
  const isLocalDev = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const shareUrl = config
    ? (isLocalDev ? `${window.location.origin}/light/index.html#/menu/${config.uid}` : publicUrl)
    : "";
  const previewUrl = shareUrl;
  const designMeta = MENU_DESIGNS.find(d => d.id === config?.selectedDesign);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{menuLabel}</h1>
          <p className="text-muted-foreground mt-1">
            Gérez le lien public, le design visuel et {showTables ? "les tables" : "les paramètres"} de votre {menuLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleOpenPublicMenu} disabled={!config?.enabled}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Voir en ligne
          </Button>
          <Switch
            checked={config?.enabled ?? false}
            onCheckedChange={handleToggleEnabled}
            disabled={loading || saving}
            id="menu-enabled"
          />
          <Label htmlFor="menu-enabled" className="text-sm font-medium text-gray-700">
            Actif
          </Label>
        </div>
      </div>

      {/* QR Code & Public Link Card */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-nack-red" />
            Lien public & QR Code
          </CardTitle>
          <CardDescription>
            Partagez ce lien ou ce QR code pour permettre aux clients d'accéder à votre {menuLabel.toLowerCase()}.
            {config?.enabled ? "" : " (Actuellement désactivé — le lien ne fonctionne pas)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg border min-w-[280px]">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code du menu" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">Génération…</div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadQr} disabled={!qrCodeDataUrl}>
                  <Download className="mr-1 h-3 w-3" />
                  Télécharger
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground max-w-xs">
                Scannez pour ouvrir le {menuLabel.toLowerCase()}
              </p>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <Label className="text-sm font-medium">Lien public</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="flex-1 font-mono text-sm bg-gray-50" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copier le lien</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleOpenPublicMenu} disabled={!config?.enabled}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Ouvrir</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className={config?.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600"}>
                  {config?.enabled ? "Actif" : "Inactif"}
                </Badge>
                <Badge variant="outline">
                  {designMeta?.label || config?.selectedDesign}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${showTables ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="produits">
            <Star className="mr-2 h-4 w-4" />
            Produits
          </TabsTrigger>
          {showTables && (
            <TabsTrigger value="tables">
              <TableIcon className="mr-2 h-4 w-4" />
              Tables ({tables.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Design Selection */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-nack-red" />
                Choix du design
              </CardTitle>
              <CardDescription>
                Sélectionnez le style visuel de votre {menuLabel.toLowerCase()}. Le changement est immédiat pour vos clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {MENU_DESIGNS.map((design) => {
                  const isSelected = config?.selectedDesign === design.id;
                  return (
                    <TooltipProvider key={design.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleDesignChange(design.id)}
                            disabled={saving || isSelected}
                            className={`relative rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-nack-red bg-nack-red/5 shadow-lg ring-2 ring-nack-red/20"
                                : "border-gray-200 hover:border-nack-red/50 hover:shadow-md"
                            } group`}
                          >
                            <div className="absolute -top-2 -right-2 z-10">
                              {isSelected && (
                                <Badge className="bg-nack-red text-white">
                                  <Check className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                            <div className="h-full w-full flex flex-col gap-2 p-3">
                              <DesignMiniPreview design={design.id} />
                              <div className="text-center">
                                <p className="font-medium text-gray-900 text-sm">{design.label}</p>
                                <p className="text-[11px] leading-tight text-muted-foreground mt-0.5">{design.description}</p>
                              </div>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{design.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Mode Plat du jour */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-nack-red" />
                Mode Plat du jour
              </CardTitle>
              <CardDescription>
                Quand activé et qu'au moins un produit est coché "Plat du jour", le menu public n'affiche que les plats du jour + vedettes.
                Désactivé : tous les produits s'affichent, daily/vedette juste en haut.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="daily-special-mode">Filtrer par plat du jour</Label>
                  <p className="text-xs text-muted-foreground">
                    {dailySpecialMode ? "Activé — seuls plat du jour et vedettes sont visibles" : "Désactivé — tous les produits sont visibles"}
                  </p>
                </div>
                <Switch
                  id="daily-special-mode"
                  checked={dailySpecialMode}
                  onCheckedChange={handleToggleDailyMode}
                  disabled={saving || loading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview iframe */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-nack-red" />
                Aperçu en temps réel
              </CardTitle>
              <CardDescription>
                Voici à quoi ressemble votre {menuLabel.toLowerCase()} pour vos clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full rounded-lg border overflow-hidden bg-white">
                {config?.enabled ? (
                  <iframe
                    src={`${previewUrl}?embed=1`}
                    className="w-full h-full border-0"
                    title={`Aperçu ${menuLabel}`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-center p-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Menu désactivé</p>
                    <p className="mt-1">Activez le menu pour voir l'aperçu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Livraison */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-nack-red" />
                Livraison
              </CardTitle>
              <CardDescription>
                Configurez les options de livraison pour les commandes en ligne.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="delivery-enabled-menu">Activer la livraison</Label>
                  <p className="text-xs text-muted-foreground">Permet aux clients de choisir la livraison lors de la commande</p>
                </div>
                <Switch
                  id="delivery-enabled-menu"
                  checked={deliveryEnabled}
                  onCheckedChange={setDeliveryEnabled}
                />
              </div>
              {deliveryEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                  <Label htmlFor="delivery-price-menu">Frais de livraison (XAF)</Label>
                  <Input
                    id="delivery-price-menu"
                    type="number"
                    min="0"
                    step="100"
                    value={deliveryPrice}
                    onChange={(e) => setDeliveryPrice(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 1500"
                    className="w-40"
                  />
                  <p className="text-xs text-muted-foreground">Ce montant sera ajouté au total de la commande</p>
                </div>
              )}
              <Button onClick={handleSaveDelivery} disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Sauvegarder
              </Button>
            </CardContent>
          </Card>

          {/* Paiements */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-nack-red" />
                Paiements en ligne
              </CardTitle>
              <CardDescription>
                Informations sur les paiements mobiles et le NIS distributeur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Statut */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="space-y-0.5">
                  <p className="font-medium text-gray-900">Statut des paiements</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.disbursementStatus === "approved" ? "Activé par l'administrateur" : 
                     profile?.disbursementStatus === "pending" ? "En attente d'approbation" : 
                     "Désactivé"}
                  </p>
                </div>
                <Badge variant="outline" className={
                  profile?.disbursementStatus === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                  profile?.disbursementStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  "bg-gray-50 text-gray-600"
                }>
                  {profile?.disbursementStatus === "approved" ? "✓ Activé" :
                   profile?.disbursementStatus === "pending" ? "⏳ En attente" :
                   "✗ Désactivé"}
                </Badge>
              </div>

              {/* NIS Distributeur */}
              {profile?.disbursementId && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">NIS Distributeur</Label>
                  <div className="flex items-center gap-2">
                    <Input value={profile.disbursementId} readOnly className="flex-1 font-mono text-sm bg-gray-50" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(profile.disbursementId!, toast)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copier le NIS</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ID attribué par l'administrateur pour recevoir les paiements
                  </p>
                </div>
              )}

              {/* Méthodes acceptées */}
              {profile?.disbursementStatus === "approved" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Méthodes de paiement acceptées</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-red-600 font-bold text-xs">A</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Airtel Money</p>
                        <p className="text-xs text-muted-foreground">Accepté</p>
                      </div>
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-xs">M</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Moov Money</p>
                        <p className="text-xs text-muted-foreground">Accepté</p>
                      </div>
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Message d'information */}
              {profile?.disbursementStatus !== "approved" && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Paiements non activés</p>
                      <p className="text-xs">
                        Contactez l'administrateur pour activer les paiements en ligne. 
                        Une fois activé, vos clients pourront payer via Airtel Money et Moov Money 
                        pour les commandes du menu, les billets d'événements, et autres services.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produits Tab */}
        <TabsContent value="produits" className="space-y-6 mt-4">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-nack-red" />
                Produits vedettes & plats du jour
              </CardTitle>
              <CardDescription>
                Activez les produits à mettre en avant dans le menu public.
                {dailySpecialMode ? " Le mode Plat du jour est activé — seuls les produits Vedettes et Plat du jour seront visibles." : " Tous les produits sont visibles, ceux cochés ici apparaissent en haut du menu."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activatableProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Aucun produit trouvé</p>
                  <p className="text-sm text-muted-foreground mt-1">Créez des produits dans l'onglet Stock</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activatableProducts.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition ${p.showInMenu !== false ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          <Eye className="h-3 w-3 inline" /> Menu
                        </Label>
                        <Switch
                          checked={p.showInMenu !== false}
                          onCheckedChange={() => handleToggleProductFlag(p.id, "showInMenu", p.showInMenu !== false)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.name}</p>
                        {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isDailySpecial && <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">Plat du jour</Badge>}
                        {p.isFeatured && <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">Vedette</Badge>}
                        {p.isPromotional && <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Promo</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            <Flame className="h-3 w-3 inline" /> Jour
                          </Label>
                          <Switch
                            checked={p.isDailySpecial ?? false}
                            onCheckedChange={() => handleToggleProductFlag(p.id, "isDailySpecial", p.isDailySpecial ?? false)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            <Star className="h-3 w-3 inline" /> Vedette
                          </Label>
                          <Switch
                            checked={p.isFeatured ?? false}
                            onCheckedChange={() => handleToggleProductFlag(p.id, "isFeatured", p.isFeatured ?? false)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables Tab */}
        {showTables && (
          <TabsContent value="tables" className="space-y-6 mt-4">
            <Card className="border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-nack-red" />
                    Gestion des tables
                  </CardTitle>
                  <CardDescription>
                    Chaque table a son propre QR code. Le client scanne, commande, et la commande arrive avec le numéro de table.
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une table
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle>Ajouter une table</DialogTitle>
                      <DialogDescription>
                        Numérotez ou nommez la table (ex: "5", "Terrasse A", "Comptoir").
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="table-number" className="text-right">Numéro / Nom</Label>
                        <Input id="table-number" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="ex: 5" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="table-capacity" className="text-right">Capacité (optionnel)</Label>
                        <Input id="table-capacity" type="number" value={newTableCapacity} onChange={(e) => setNewTableCapacity(e.target.value)} placeholder="ex: 4" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="table-zone" className="text-right">Zone (optionnel)</Label>
                        <Input id="table-zone" value={newTableZone} onChange={(e) => setNewTableZone(e.target.value)} placeholder="ex: Terrasse, Salle, Étage" className="col-span-3" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => { setNewTableNumber(""); setNewTableCapacity(""); setNewTableZone(""); }}>Annuler</Button>
                      <Button onClick={handleAddTable} disabled={saving || !newTableNumber.trim()}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Créer"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tables.length === 0 ? (
                  <div className="text-center py-12">
                    <TableIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Aucune table configurée</p>
                    <p className="text-sm text-muted-foreground mt-1">Ajoutez votre première table pour générer les QR codes</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tables.map((table) => (
                      <div key={table.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-nack-red/10 flex items-center justify-center">
                            <TableIcon className="h-6 w-6 text-nack-red" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Table {table.number}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              {table.capacity && <Badge variant="outline" className="text-xs">Capacité: {table.capacity}</Badge>}
                              {table.zone && <Badge variant="outline" className="text-xs">{table.zone}</Badge>}
                              <Badge variant="outline" className="text-xs">QR: {table.qrToken.slice(0, 8)}…</Badge>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => { const url = getPublicMenuUrl(uid!, table.qrToken); copyToClipboard(url, toast); }}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Copier le lien table</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => { const url = getPublicMenuUrl(uid!, table.qrToken); window.open(url, "_blank"); }}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Ouvrir le menu table</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => { const qr = tableQrCodes[table.id]; if (qr) downloadQRCode(qr, `table-${table.number}-qr.png`); }}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Télécharger QR</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleRegenerateQr(table)} disabled={saving}>
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Régénérer QR</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleEditTable(table)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Modifier</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="destructive" size="icon" onClick={() => handleDeleteTable(table.id)} disabled={saving}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Supprimer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}