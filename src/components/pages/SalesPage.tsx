import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import OrderManagement from "@/components/OrderManagement";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Search,
  ClipboardList,
  Package,
  Beer,
  Wine,
  Coffee,
  GlassWater,
  Pizza,
  Sandwich,
  Cookie,
  IceCream,
  Cherry,
  Apple,
  QrCode,
  Trash2,
  Utensils,
  Settings,
  Box,
  ShoppingBag,
  Lightbulb,
  Grid3x3
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ordersColRef, productsColRef, salesColRef } from "@/lib/collections";
import { addDoc, doc as fsDoc, getDoc, onSnapshot, orderBy, query, runTransaction, where, updateDoc, writeBatch, doc as fsDocDirect } from "firebase/firestore";
import type { ProductDoc, PaymentMethod, SaleDoc, SaleItem } from "@/types/inventory";
import type { UserProfile } from "@/types/profile";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  imageUrl?: string;
  icon?: string;
  formula?: {
    units: number;
    price: number;
  };
}

interface CartItem extends Product {
  quantity: number;
  isFormula?: boolean;
}

interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  createdAt: number;
  type?: 'bar-connectee' | 'normal';
  establishmentName?: string;
  tableZone?: string;
  orderNumber?: string;
}

const SalesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Fonction pour récupérer les détails d'un produit par ID
  const getProductById = (productId: string): Product | undefined => {
    return products.find(p => p.id === productId);
  };

  // Fonction pour obtenir l'image d'un produit
  const getProductImage = (product: Product | undefined): string | null => {
    if (!product) return null;
    return product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : null;
  };

  const applyPrefillFromStorage = () => {
    try {
      const raw = localStorage.getItem('nack_prefill_cart');
      if (!raw) return false;
      const items = JSON.parse(raw) as Array<{ id: string; name: string; price: number; quantity: number }>;
      if (!Array.isArray(items) || !items.length) return false;
      setCart(items.map(it => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity, category: '', stock: 9999 })));
      setSelectedPayment('cash');
      setIsCheckoutOpen(true);
      localStorage.removeItem('nack_prefill_cart');
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(productsColRef(db, user.uid), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as Partial<ProductDoc>;
        return {
          id: d.id,
          name: data.name || "",
          price: Number((data.price as number | string | undefined) ?? 0) || 0,
          category: data.category || "",
          stock: Number((data.quantity as number | string | undefined) ?? 0) || 0,
          imageUrl: data.imageUrl,
          icon: data.icon,
          formula: data.formula && typeof data.formula.units !== 'undefined' && typeof data.formula.price !== 'undefined'
            ? { units: Number(data.formula.units) || 0, price: Number(data.formula.price) || 0 }
            : undefined,
        } as Product;
      });
      setProducts(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(salesColRef(db, user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Sale[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }));
      setSales(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(ordersColRef(db, user.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nack_prefill_cart');
      if (raw) {
        const items = JSON.parse(raw) as Array<{ id: string; name: string; price: number; quantity: number }>;
        if (Array.isArray(items) && items.length) {
          setCart(items.map(it => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity, category: '', stock: 9999 })));
          setSelectedPayment('cash');
          setIsCheckoutOpen(true);
          localStorage.removeItem('nack_prefill_cart');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Produits vendables (avec prix - le stock n'est pas requis pour les menus/plats)
  const sellableProducts = products
    // Inclure uniquement les produits avec prix de vente (ce sont des produits vendables)
    // Pour les menus/plats de restaurant, le stock n'est pas requis (quantité peut être 0)
    .filter(product => {
      const hasPrice = product.price > 0;
      const hasFormulaPrice = product.formula && product.formula.price > 0;
      return hasPrice || hasFormulaPrice;
    });
    // Note: On n'exclut plus les produits sans stock car les menus peuvent être vendus sans quantité

  // Calculer les catégories disponibles dynamiquement
  const availableCategories = [...new Set(sellableProducts.map(p => p.category).filter(Boolean))].sort();

  // Fonction pour obtenir l'icône selon la catégorie
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('boisson') || cat.includes('eau') || cat.includes('jus') || cat.includes('soda')) return GlassWater;
    if (cat.includes('alcool') || cat.includes('vin') || cat.includes('biere')) return Wine;
    if (cat.includes('cafe')) return Coffee;
    if (cat.includes('plat') || cat.includes('pizza') || cat.includes('sandwich')) return Pizza;
    if (cat.includes('dessert') || cat.includes('glace') || cat.includes('sucre') || cat.includes('cookie')) return IceCream;
    if (cat.includes('snack')) return Cookie;
    if (cat.includes('ustensile')) return Utensils;
    if (cat.includes('équipement') || cat.includes('equipement')) return Settings;
    if (cat.includes('fourniture')) return Box;
    return Package;
  };

  // Fonction pour obtenir le texte d'affichage de la catégorie
  const getCategoryDisplayText = (category: string) => {
    return category === "all" ? "Toutes les catégories" : category;
  };

  // Réinitialiser l'onglet actif si la catégorie n'existe plus
  useEffect(() => {
    if (activeCategoryTab !== "all" && !availableCategories.includes(activeCategoryTab)) {
      setActiveCategoryTab("all");
    }
  }, [availableCategories, activeCategoryTab]);

  const filteredProducts = sellableProducts
    .filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(product => {
      if (activeCategoryTab === "all") return true;
      return product.category === activeCategoryTab;
    });

  const addToCart = (product: Product, isFormula: boolean = false) => {
    const priceToUse = isFormula && product.formula ? product.formula.price : product.price;
    const quantityToAdd = isFormula && product.formula ? product.formula.units : 1;
    const existingItem = cart.find(item => item.id === product.id && item.isFormula === isFormula);
    const isPlat = product.category?.toLowerCase() === 'plats';
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd;
      // Pour les plats, ignorer la vérification de stock
      if (isPlat) {
        setCart(cart.map(item =>
          item.id === product.id && item.isFormula === isFormula
            ? { ...item, quantity: newQuantity }
            : item
        ));
      } else {
        const maxStock = isFormula && product.formula 
          ? Math.floor((product.stock || 0) / ((product.formula.units || 1)))
          : (product.stock || 0);
        
        // Permettre l'ajout si stock = 0 (menus) ou si quantité <= stock
        if (maxStock === 0 || newQuantity <= maxStock) {
          setCart(cart.map(item =>
            item.id === product.id && item.isFormula === isFormula
              ? { ...item, quantity: newQuantity }
              : item
          ));
        } else {
          toast({
            title: "Stock insuffisant",
            description: `Il ne reste que ${maxStock} ${isFormula ? 'formules' : 'unités'} en stock`,
            variant: "destructive"
          });
        }
      }
    } else {
      setCart([...cart, { 
        ...product, 
        quantity: quantityToAdd,
        price: priceToUse,
        isFormula
      }]);
    }
  };

  const handleAddToCartClick = (product: Product) => {
    if (product.formula) {
      setSelectedProduct(product);
      setIsFormulaDialogOpen(true);
    } else {
      addToCart(product);
    }
  };

  const updateQuantity = (id: string, quantity: number, isFormula: boolean = false) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => !(item.id === id && item.isFormula === isFormula)));
    } else {
      setCart(cart.map(item =>
        item.id === id && item.isFormula === isFormula ? { ...item, quantity } : item
      ));
    }
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const handleSale = async () => {
    if (!user) return;
    if (!selectedPayment) {
      toast({ title: "Mode de paiement requis", description: "Veuillez sélectionner un mode de paiement", variant: "destructive" });
      return;
    }
    if (isSaving) return;

    try {
      // Pré-contrôle des stocks, ajuster le panier si nécessaire
      const adjusted: CartItem[] = [];
      const changes: string[] = [];
      for (const item of cart) {
        const ref = fsDoc(productsColRef(db, user.uid), item.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          changes.push(`${item.name}: supprimé (produit introuvable)`);
          continue;
        }
        const data = snap.data() as ProductDoc;
        const currentQty = Number((data as { quantity?: number }).quantity ?? 0);
        if (currentQty <= 0) {
          changes.push(`${item.name}: supprimé (stock épuisé)`);
          continue;
        }
        const desired = Number(item.quantity || 0);
        if (desired > currentQty) {
          adjusted.push({ ...item, quantity: currentQty });
          changes.push(`${item.name}: limité à ${currentQty}`);
        } else {
          adjusted.push(item);
        }
      }
      if (changes.length > 0) {
        setCart(adjusted);
        setIsCheckoutOpen(true);
        toast({ title: "Stock ajusté", description: changes.join(" • "), variant: "destructive" });
        return;
      }

      setIsSaving(true);
      // 1) Déterminer le propriétaire pour l'écriture (meta > user)
      let ownerUidForWrites: string | undefined = user?.uid;
      try {
        const metaRaw = localStorage.getItem('nack_prefill_order_meta');
        if (metaRaw) {
          const meta = JSON.parse(metaRaw) as { ownerUid?: string };
          if (meta.ownerUid) ownerUidForWrites = meta.ownerUid;
        }
      } catch { /* ignore */ }
      if (!ownerUidForWrites) throw new Error("Propriétaire introuvable pour l'écriture");
      // 2) Batch atomique: décrémenter le stock + créer la vente
      const batch = writeBatch(db);
        for (const item of cart) {
          const productRef = fsDoc(productsColRef(db, ownerUidForWrites), item.id);
        const snap = await getDoc(productRef);
          if (!snap.exists()) throw new Error(`Produit introuvable: ${item.name}`);
          const data = snap.data() as ProductDoc;
        const qtyToDecrement = Number(item.quantity || 0);
        const currentQty = Number((data as { quantity?: number }).quantity ?? 0);
        if (qtyToDecrement <= 0) continue;
        if (currentQty < qtyToDecrement) throw new Error(`Stock insuffisant pour ${item.name}`);
        batch.update(productRef, { quantity: currentQty - qtyToDecrement, updatedAt: Date.now() });
        }
        const saleItems: SaleItem[] = cart.map(ci => ({ id: ci.id, name: ci.name, price: ci.price, quantity: ci.quantity, isFormula: ci.isFormula }));
              const saleCol = salesColRef(db, ownerUidForWrites);
        // create new sale doc id
        const saleRef = fsDoc(saleCol);
      const saleDoc: SaleDoc = { items: saleItems, total: cartTotal, paymentMethod: selectedPayment, createdAt: Date.now() };
      batch.set(saleRef, saleDoc);
      await batch.commit();

      // Marquer la commande source comme "Validée" si meta présent
      try {
        const metaRaw = localStorage.getItem('nack_prefill_order_meta');
        if (metaRaw) {
          const meta = JSON.parse(metaRaw) as { orderId?: string; ownerUid?: string };
          if (meta.orderId) {
            const owner = meta.ownerUid || user.uid;
            await updateDoc(fsDoc(ordersColRef(db, owner), meta.orderId), { status: 'sent' });
          }
          localStorage.removeItem('nack_prefill_order_meta');
        }
      } catch { /* ignore */ }

      toast({ title: "Vente enregistrée", description: `Vente de ${cartTotal.toLocaleString()} XAF` });
      
      // Proposer d'imprimer le reçu pour le client
      const shouldPrint = window.confirm(`Vente enregistrée avec succès !\n\nSouhaitez-vous imprimer le reçu pour le client ?`);
      if (shouldPrint) {
        try {
          // Récupérer toutes les informations du profil pour le ticket
          const profileRef = fsDoc(db, 'profiles', ownerUidForWrites);
          const profileSnap = await getDoc(profileRef);
          const profileData = profileSnap.exists() ? profileSnap.data() as UserProfile : null;
          
          const thermalData = {
            orderNumber: `V-${Date.now()}`,
            establishmentName: profileData?.establishmentName || 'Établissement',
            establishmentLogo: profileData?.logoUrl,
            tableZone: 'Caisse',
            items: cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price
            })),
            total: cartTotal,
            createdAt: Date.now(),
            // Informations personnalisées du profil
            companyName: profileData?.companyName,
            fullAddress: profileData?.fullAddress,
            businessPhone: profileData?.businessPhone || profileData?.phone,
            rcsNumber: profileData?.rcsNumber,
            nifNumber: profileData?.nifNumber,
            legalMentions: profileData?.legalMentions,
            customMessage: profileData?.customMessage
          };

          const { printThermalTicket } = await import('@/utils/ticketThermal');
          printThermalTicket(thermalData);
        } catch (error) {
          console.error('Erreur impression reçu:', error);
          // Ne pas bloquer, juste logger l'erreur
        }
      }
      
      setCart([]);
      setSelectedPayment(null);
      setIsCheckoutOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderIconByName = (name?: string) => {
    switch (name) {
      case 'Beer': return <Beer size={32} className="text-nack-red" />;
      case 'Wine': return <Wine size={32} className="text-nack-red" />;
      case 'Coffee': return <Coffee size={32} className="text-nack-red" />;
      case 'GlassWater': return <GlassWater size={32} className="text-nack-red" />;
      case 'Pizza': return <Pizza size={32} className="text-nack-red" />;
      case 'Sandwich': return <Sandwich size={32} className="text-nack-red" />;
      case 'Cookie': return <Cookie size={32} className="text-nack-red" />;
      case 'IceCream': return <IceCream size={32} className="text-nack-red" />;
      case 'Cherry': return <Cherry size={32} className="text-nack-red" />;
      case 'Apple': return <Apple size={32} className="text-nack-red" />;
      default: return <Package size={32} className="text-muted-foreground" />;
    }
  };

  const renderProductVisual = (product: Product) => {
    if (product.imageUrl) {
      return (
        <div className="w-20 h-20 mx-auto mb-1 rounded-md overflow-hidden bg-nack-beige-light">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      );
    }
    return (
      <div className="w-20 h-20 mx-auto mb-1 rounded-md bg-nack-beige-light flex items-center justify-center">
        {renderIconByName(product.icon)}
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-[70vh] w-full flex-col">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-0">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <Card className="shadow-card border-0">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Produits disponibles</CardTitle>
                  <CardDescription>Sélectionnez les produits à vendre</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Rechercher un produit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full md:w-[300px]"
                    />
                  </div>
                </div>
              </div>
                {/* Sélecteur de Catégorie - Menu déroulant compact */}
                <div className="w-full border-b border-[#e6dfdb] pb-3">
                  <div className="flex items-center gap-3">
                    <Grid3x3 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <Select value={activeCategoryTab} onValueChange={setActiveCategoryTab}>
                      <SelectTrigger className="w-full sm:w-[250px] border-[#e6dfdb] focus:ring-nack-red">
                        <SelectValue placeholder="Sélectionner une catégorie">
                          {activeCategoryTab === "all" ? "Toutes les catégories" : activeCategoryTab}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Grid3x3 className="h-4 w-4" />
                            <span>Toutes les catégories</span>
                          </div>
                        </SelectItem>
                        {availableCategories.length > 0 ? (
                          availableCategories.map((category) => {
                            const Icon = getCategoryIcon(category);
                            return (
                              <SelectItem key={category} value={category}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{category}</span>
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="none" disabled>
                            Aucune catégorie disponible
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {activeCategoryTab !== "all" && (
                      <Badge variant="outline" className="bg-nack-red/10 text-nack-red border-nack-red/20">
                        {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
                {filteredProducts.map((product) => {
                  const imageUrl = product.imageUrl || undefined;
                  const colorClass = (() => {
                    const c = (product.category || '').toLowerCase();
                    if (c.includes('vin') || c.includes('alcool')) return 'bg-red-500';
                    if (c.includes('biere') || c.includes('boisson')) return 'bg-yellow-500';
                    if (c.includes('cafe')) return 'bg-purple-500';
                    if (c.includes('eau')) return 'bg-blue-500';
                    if (c.includes('jus')) return 'bg-orange-500';
                    if (c.includes('soda')) return 'bg-green-500';
                    if (c.includes('dessert') || c.includes('glace')) return 'bg-pink-500';
                    return 'bg-gray-200';
                  })();
                  return (
                    <button
                    key={product.id} 
                      type="button"
                      className="relative rounded-2xl border border-gray-200 bg-white p-3 shadow-lg transition hover:shadow-2xl hover:border-gray-300 text-left"
                    onClick={() => handleAddToCartClick(product)}
                  >
                      <div className={`absolute left-0 top-0 h-1 w-full rounded-t-2xl ${colorClass}`} />
                      <div
                        className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-xl"
                        style={{ 
                          backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg,#f5f2f0,#e6dfdb)',
                          display: 'block',
                          visibility: 'visible',
                          opacity: 1
                        }}
                      />
                      <div className="mt-2 space-y-0.5">
                        <h3 className="font-semibold text-base truncate">{product.name}</h3>
                        {/* Afficher le stock uniquement s'il est > 0 (pas pour les menus/plats sans quantité) */}
                        {(product.stock || 0) > 0 && (
                          <p className="text-xs text-muted-foreground">Stock: {Number(product.stock || 0)}</p>
                        )}
                        <p className="text-xl md:text-2xl font-extrabold text-nack-red" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                          {(() => {
                            const price = Number(product.price || 0);
                            if (price > 0) {
                              return `${price.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF`;
                            }
                            return product.formula && product.formula.price > 0 
                              ? `${Number(product.formula.price).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF`
                              : '0 XAF';
                          })()}
                        </p>
                      </div>
                      {/* Ne pas afficher "Rupture" pour les produits sans stock (menus/plats) */}
                      <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-nack-red text-white shadow-xl">
                        <Plus className="h-7 w-7" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Panier
                {cart.length > 0 && (
                  <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-primary text-white shadow-button">
                        Finaliser la vente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Finaliser la vente</DialogTitle>
                        <DialogDescription style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                          Total: {cartTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-3">
                          <p className="font-medium">Mode de paiement:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button
                              variant={selectedPayment === 'card' ? 'default' : 'outline'}
                              onClick={() => setSelectedPayment('card')}
                            >
                              <CreditCard size={20} />
                              <span className="ml-2">Carte</span>
                            </Button>
                            <Button
                              variant={selectedPayment === 'cash' ? 'default' : 'outline'}
                              onClick={() => setSelectedPayment('cash')}
                            >
                              <Banknote size={20} />
                              <span className="ml-2">Cash</span>
                            </Button>
                          </div>
                        </div>
                        <div className="bg-nack-beige-light p-3 sm:p-4 rounded-lg max-h-40 overflow-y-auto">
                          <h4 className="font-semibold mb-2 text-sm">Récapitulatif:</h4>
                          {cart.map(item => (
                            <div key={item.id + String(item.isFormula)} className="flex justify-between text-xs sm:text-sm">
                              <span>{item.name} x{item.quantity}</span>
                              <span style={{ display: 'inline-block', visibility: 'visible', opacity: 1 }}>
                                {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                              </span>
                            </div>
                          ))}
                          <div className="border-t mt-2 pt-2 font-semibold text-sm">
                            Total: <span style={{ display: 'inline-block', visibility: 'visible', opacity: 1 }}>
                              {cartTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCheckoutOpen(false)} className="w-full sm:w-auto">
                          Annuler
                        </Button>
                        <Button onClick={handleSale} disabled={isSaving} className="bg-gradient-primary text-white w-full sm:w-auto">
                          Confirmer la vente
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun article dans le panier
                </p>
              ) : (
                <div className="space-y-3">
                   {cart.map((item) => (
                     <div key={`${item.id}-${item.isFormula ? 'formula' : 'single'}`} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                       <div className="flex-1">
                         <p className="font-medium text-sm">
                           {item.name}
                         </p>
                         <p className="text-sm text-muted-foreground">{item.price.toLocaleString()} XAF</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => updateQuantity(item.id, item.quantity - 1, item.isFormula)}
                         >
                           <Minus size={16} />
                         </Button>
                         <span className="w-8 text-center font-medium">{item.quantity}</span>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => updateQuantity(item.id, item.quantity + 1, item.isFormula)}
                           disabled={item.stock > 0 && item.quantity >= item.stock}
                         >
                           <Plus size={16} />
                         </Button>
                       </div>
                     </div>
                   ))}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-nack-red" style={{ display: 'inline-block', visibility: 'visible', opacity: 1 }}>
                        {cartTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="shadow-card border-0 mt-6">
            <CardHeader>
              <CardTitle>Dernières ventes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sales.slice(0, 3).map((sale) => (
                  <div key={sale.id} className="flex items-start gap-3 p-3 bg-nack-beige-light rounded-lg">
                    {/* Images des produits */}
                    <div className="flex gap-1 flex-shrink-0">
                      {sale.items.slice(0, 3).map((item, index) => {
                        const product = getProductById(item.id);
                        const imageUrl = getProductImage(product);
                        return (
                          <div key={`${sale.id}-${item.id}-${index}`} className="w-8 h-8 rounded-md overflow-hidden bg-gray-100">
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={item.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center text-xs font-bold text-gray-600 ${imageUrl ? 'hidden' : ''}`}>
                              {item.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        );
                      })}
                      {sale.items.length > 3 && (
                        <div className="w-8 h-8 rounded-md bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                          +{sale.items.length - 3}
                        </div>
                      )}
                    </div>

                    {/* Détails de la vente */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {sale.items.map(item => `${item.name} x${item.quantity}`).join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleTimeString()} • {sale.paymentMethod === 'card' ? 'Carte' : 'Cash'}
                        {sale.type === 'bar-connectee' && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            Bar Connectée
                          </span>
                        )}
                      </p>
                      {sale.type === 'bar-connectee' && sale.establishmentName && (
                        <p className="text-xs text-blue-600 font-medium">
                          📍 {sale.establishmentName} • {sale.tableZone}
                        </p>
                      )}
                    </div>

                    {/* Montant */}
                    <div className="flex-shrink-0">
                      <span className="font-semibold text-green-600" style={{ display: 'inline-block', visibility: 'visible', opacity: 1 }}>
                        +{sale.total.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                      </span>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && <p className="text-sm text-muted-foreground">Aucune vente récente</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Barre flottante total / actions */}
      <div className="pointer-events-none fixed left-0 right-0 bottom-20 z-20 px-4 md:px-6">
        {cart.length > 0 && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-nack-red/95 p-3 text-white shadow-2xl">
            <button
              className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-700/80"
              onClick={() => setCart([])}
              title="Vider"
            >
              <Trash2 className="h-8 w-8" />
            </button>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                {cartTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
              </span>
            </div>
            <button
              className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-600/90"
              onClick={() => setIsCheckoutOpen(true)}
              title="Payer"
            >
              <CreditCard className="h-8 w-8" />
            </button>
          </div>
        )}
      </div>
      {/* Dialog de sélection formule/produit unitaire */}
      <Dialog open={isFormulaDialogOpen} onOpenChange={setIsFormulaDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sélectionner le type d'achat</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - Choisissez entre un produit unitaire ou la formule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedProduct) addToCart(selectedProduct, false);
                  setIsFormulaDialogOpen(false);
                }}
                className="h-16 flex flex-col gap-2 border-2 hover:border-nack-red"
              >
                <span className="font-semibold">Produit unitaire</span>
                <span className="text-sm text-muted-foreground">
                  {Number(selectedProduct?.price || 0).toLocaleString()} XAF l'unité
                </span>
              </Button>
              {selectedProduct?.formula && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedProduct) addToCart(selectedProduct, true);
                    setIsFormulaDialogOpen(false);
                  }}
                  className="h-16 flex flex-col gap-2 border-2 hover:border-nack-red"
                >
                  <span className="font-semibold">Formule</span>
                  <span className="text-sm text-muted-foreground">
                    {(selectedProduct.formula.units || 0)} unités à {Number(selectedProduct.formula.price || 0).toLocaleString()} XAF
                  </span>
                </Button>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsFormulaDialogOpen(false)}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPage;