import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut,
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  ArrowUpDown,
  Pencil,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { ensureAgentSession } from "@/lib/agentSession";
import { productsColRef, agentTokensTopColRef, lossesColRef } from "@/lib/collections";
import {
  addDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  collectionGroup,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FirestoreTeamMemberDoc {
  firstName: string;
  lastName: string;
  role?: string;
  agentCode?: string;
  agentToken?: string;
}

interface StockProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  imageUrl?: string;
}

const getStockAuthKey = (agentCode: string) => `nack_stock_auth_${agentCode}`;

const StockInterface = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string } | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Stock entry/exit dialog
  const [stockDialog, setStockDialog] = useState<{ open: boolean; product: StockProduct | null; mode: "entry" | "exit" }>({
    open: false,
    product: null,
    mode: "entry",
  });
  const [stockAmount, setStockAmount] = useState("");
  const [stockReason, setStockReason] = useState("");

  // Add/Edit product dialog
  const [productDialog, setProductDialog] = useState<{ open: boolean; editing: StockProduct | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState({ name: "", category: "", price: "", quantity: "" });

  // Resolve owner from agent token
  useEffect(() => {
    const resolveOwner = async () => {
      if (!agentCode) return;
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string; role?: string };
          if (data.ownerUid && data.role === "gestionnaire-stock") {
            await ensureAgentSession(agentCode, data.ownerUid);
            setOwnerUid(data.ownerUid);
            setAgentInfo({ name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Agent", code: agentCode });
            try {
              localStorage.setItem(getStockAuthKey(agentCode), JSON.stringify({
                ownerUid: data.ownerUid,
                agentName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
                timestamp: Date.now(),
              }));
            } catch { /* ignore */ }
            return;
          }
        }
      } catch { /* ignore */ }
      // Fallback: collectionGroup search
      try {
        const cg = collectionGroup(db, "team");
        const byToken = query(cg, where("agentToken", "==", agentCode), limit(1));
        const s1 = await getDocs(byToken);
        if (!s1.empty) {
          const docSnap = s1.docs[0];
          const data = docSnap.data() as FirestoreTeamMemberDoc;
          if (data.role !== "gestionnaire-stock") return;
          const foundOwner = docSnap.ref.parent.parent?.id;
          if (foundOwner) {
            await ensureAgentSession(agentCode, foundOwner);
            setOwnerUid(foundOwner);
            setAgentInfo({ name: `${data.firstName} ${data.lastName}`.trim() || "Agent", code: agentCode });
            try {
              localStorage.setItem(getStockAuthKey(agentCode), JSON.stringify({
                ownerUid: foundOwner,
                agentName: `${data.firstName} ${data.lastName}`.trim(),
                timestamp: Date.now(),
              }));
            } catch { /* ignore */ }
            return;
          }
        }
        const byCode = query(cg, where("agentCode", "==", agentCode), limit(1));
        const s2 = await getDocs(byCode);
        if (!s2.empty) {
          const docSnap = s2.docs[0];
          const data = docSnap.data() as FirestoreTeamMemberDoc;
          if (data.role !== "gestionnaire-stock") return;
          const foundOwner = docSnap.ref.parent.parent?.id;
          if (foundOwner) {
            await ensureAgentSession(agentCode, foundOwner);
            setOwnerUid(foundOwner);
            setAgentInfo({ name: `${data.firstName} ${data.lastName}`.trim() || "Agent", code: agentCode });
            try {
              localStorage.setItem(getStockAuthKey(agentCode), JSON.stringify({
                ownerUid: foundOwner,
                agentName: `${data.firstName} ${data.lastName}`.trim(),
                timestamp: Date.now(),
              }));
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore permissions */ }
    };
    resolveOwner();
  }, [agentCode]);

  // Subscribe to products
  useEffect(() => {
    if (!ownerUid) { setProducts([]); setLoading(false); return; }
    const unsub = onSnapshot(productsColRef(db, ownerUid), (snap) => {
      const list: StockProduct[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data.name || ""),
          price: Number(data.price || 0),
          category: String(data.category || ""),
          quantity: Number(data.quantity || 0),
          imageUrl: (data.imageUrl as string) || undefined,
        };
      });
      setProducts(list);
      setLoading(false);
    });
    return () => unsub();
  }, [ownerUid]);

  const sellableProducts = products.filter((p) => p.price > 0);
  const categories = [...new Set(sellableProducts.map((p) => p.category).filter(Boolean))].sort();
  const filteredProducts = sellableProducts
    .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((p) => activeCategoryTab === "all" || p.category === activeCategoryTab);

  const handleStockOperation = async () => {
    if (!ownerUid || !stockDialog.product || !stockAmount) return;
    const amount = parseInt(stockAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Erreur", description: "Quantité invalide", variant: "destructive" });
      return;
    }

    const productRef = doc(productsColRef(db, ownerUid), stockDialog.product.id);
    const currentQty = stockDialog.product.quantity;
    const newQty = stockDialog.mode === "entry" ? currentQty + amount : Math.max(0, currentQty - amount);

    try {
      await updateDoc(productRef, { quantity: newQty, updatedAt: Date.now() });

      // Log loss for exit
      if (stockDialog.mode === "exit") {
        try {
          await addDoc(lossesColRef(db, ownerUid), {
            productId: stockDialog.product.id,
            productName: stockDialog.product.name,
            quantity: amount,
            reason: stockReason || "Sortie de stock",
            recordedBy: agentInfo?.name || "Agent",
            createdAt: Date.now(),
          });
        } catch { /* ignore loss log errors */ }
      }

      toast({
        title: stockDialog.mode === "entry" ? "Entrée enregistrée" : "Sortie enregistrée",
        description: `${stockDialog.product.name}: ${stockDialog.mode === "entry" ? "+" : "-"}${amount} (nouveau stock: ${newQty})`,
      });
      setStockDialog({ open: false, product: null, mode: "entry" });
      setStockAmount("");
      setStockReason("");
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de modifier le stock", variant: "destructive" });
    }
  };

  const handleSaveProduct = async () => {
    if (!ownerUid) return;
    if (!form.name || !form.category || !form.price) {
      toast({ title: "Erreur", description: "Nom, catégorie et prix requis", variant: "destructive" });
      return;
    }
    const priceNum = Number(form.price);
    const qtyNum = Number(form.quantity || 0);
    if (isNaN(priceNum) || priceNum < 0 || isNaN(qtyNum) || qtyNum < 0) {
      toast({ title: "Erreur", description: "Valeurs invalides", variant: "destructive" });
      return;
    }

    try {
      if (productDialog.editing) {
        const ref = doc(productsColRef(db, ownerUid), productDialog.editing.id);
        await updateDoc(ref, { name: form.name, category: form.category, price: priceNum, quantity: qtyNum, updatedAt: Date.now() });
        toast({ title: "Produit modifié", description: form.name });
      } else {
        await addDoc(productsColRef(db, ownerUid), {
          name: form.name,
          category: form.category,
          price: priceNum,
          quantity: qtyNum,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast({ title: "Produit ajouté", description: form.name });
      }
      setProductDialog({ open: false, editing: null });
      setForm({ name: "", category: "", price: "", quantity: "" });
    } catch {
      toast({ title: "Erreur", description: "Opération échouée", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!ownerUid) return;
    if (!window.confirm("Supprimer ce produit ?")) return;
    try {
      await deleteDoc(doc(productsColRef(db, ownerUid), id));
      toast({ title: "Produit supprimé" });
    } catch {
      toast({ title: "Erreur", description: "Suppression échouée", variant: "destructive" });
    }
  };

  if (!agentCode) return <Navigate to="/not-found" replace />;
  if (!agentInfo || !ownerUid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-nack-red" />
            <div>
              <h1 className="font-semibold text-sm">Gestion de stock</h1>
              <p className="text-xs text-muted-foreground">{agentInfo.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            localStorage.removeItem(getStockAuthKey(agentCode!));
            window.location.href = "/";
          }}>
            <LogOut className="h-4 w-4 mr-1" /> Déconnexion
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setForm({ name: "", category: "", price: "", quantity: "" }); setProductDialog({ open: true, editing: null }); }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategoryTab("all")}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition ${activeCategoryTab === "all" ? "bg-nack-red text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Tout ({sellableProducts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryTab(cat)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition ${activeCategoryTab === cat ? "bg-nack-red text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {cat} ({sellableProducts.filter((p) => p.category === cat).length})
              </button>
            ))}
          </div>
        )}

        {/* Product list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Chargement…</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="w-10 h-10 rounded-lg bg-nack-red/10 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-nack-red" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{product.category}</span>
                    <span>·</span>
                    <span>{product.price} FCFA</span>
                  </div>
                </div>
                <div className={`font-bold text-sm ${product.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                  {product.quantity}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => { setStockDialog({ open: true, product, mode: "entry" }); setStockAmount(""); setStockReason(""); }}
                    title="Entrée de stock"
                  >
                    <Plus size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    onClick={() => { setStockDialog({ open: true, product, mode: "exit" }); setStockAmount(""); setStockReason(""); }}
                    title="Sortie de stock"
                  >
                    <Minus size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setForm({ name: product.name, category: product.category, price: String(product.price), quantity: String(product.quantity) });
                      setProductDialog({ open: true, editing: product });
                    }}
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteProduct(product.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Entry/Exit Dialog */}
      <Dialog open={stockDialog.open} onOpenChange={(open) => setStockDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              {stockDialog.mode === "entry" ? "Entrée de stock" : "Sortie de stock"}
            </DialogTitle>
            <DialogDescription>{stockDialog.product?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Stock actuel</Label>
              <p className="text-2xl font-bold">{stockDialog.product?.quantity ?? 0}</p>
            </div>
            <div>
              <Label htmlFor="stock-amount">Quantité</Label>
              <Input
                id="stock-amount"
                type="number"
                min="1"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                placeholder="ex: 10"
              />
            </div>
            {stockDialog.mode === "exit" && (
              <div>
                <Label htmlFor="stock-reason">Raison (optionnel)</Label>
                <Input
                  id="stock-reason"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="ex: Cassse, vol, produit périmé…"
                />
              </div>
            )}
            {stockAmount && (
              <p className="text-sm text-muted-foreground">
                Nouveau stock : <span className="font-bold">{stockDialog.mode === "entry"
                  ? (stockDialog.product?.quantity ?? 0) + parseInt(stockAmount || "0", 10)
                  : Math.max(0, (stockDialog.product?.quantity ?? 0) - parseInt(stockAmount || "0", 10))
                }</span>
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStockDialog({ open: false, product: null, mode: "entry" })}>Annuler</Button>
              <Button onClick={handleStockOperation} disabled={!stockAmount || parseInt(stockAmount, 10) <= 0}>
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Dialog */}
      <Dialog open={productDialog.open} onOpenChange={(open) => setProductDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productDialog.editing ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="prod-name">Nom *</Label>
              <Input id="prod-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du produit" />
            </div>
            <div>
              <Label htmlFor="prod-cat">Catégorie *</Label>
              <Input id="prod-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex: Boissons, Plats…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prod-price">Prix (FCFA) *</Label>
                <Input id="prod-price" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="prod-qty">Quantité</Label>
                <Input id="prod-qty" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProductDialog({ open: false, editing: null })}>Annuler</Button>
              <Button onClick={handleSaveProduct}>{productDialog.editing ? "Modifier" : "Ajouter"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockInterface;
