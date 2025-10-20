import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  QrCode
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ordersColRef, productsColRef, salesColRef } from "@/lib/collections";
import { addDoc, doc as fsDoc, getDoc, onSnapshot, orderBy, query, runTransaction, where, updateDoc, writeBatch, doc as fsDocDirect } from "firebase/firestore";
import type { ProductDoc, PaymentMethod, SaleDoc, SaleItem } from "@/types/inventory";

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

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product, isFormula: boolean = false) => {
    const priceToUse = isFormula && product.formula ? product.formula.price : product.price;
    const quantityToAdd = isFormula && product.formula ? product.formula.units : 1;
    const existingItem = cart.find(item => item.id === product.id && item.isFormula === isFormula);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd;
      const maxStock = isFormula && product.formula 
        ? Math.floor((product.stock || 0) / ((product.formula.units || 1)))
        : (product.stock || 0);
        
      if (newQuantity <= maxStock) {
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
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Déclencher le changement d'onglet vers Bar Connectée avec focus sur les commandes
                      const event = new CustomEvent('nack:tab:change', { 
                        detail: { tab: 'bar-connectee', subTab: 'orders' } 
                      });
                      window.dispatchEvent(event);
                    }}
                    className="gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Commandes Clients
                  </Button>
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
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer relative"
                    onClick={() => handleAddToCartClick(product)}
                  >
                    <CardContent className="p-3 text-center">
                      {renderProductVisual(product)}
                      <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                      <p className="text-lg font-bold text-nack-red mb-1">{Number(product.price || 0).toLocaleString()} XAF</p>
                      <p className="text-xs text-muted-foreground mb-2">Stock: {Number(product.stock || 0)}</p>
                      <div className="flex gap-1">
                        <Button 
                          className="flex-1 bg-gradient-primary text-white shadow-button text-xs h-8"
                          disabled={(product.stock || 0) === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCartClick(product);
                          }}
                        >
                          <ShoppingCart size={12} className="mr-1" />
                          Panier
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                        <DialogDescription>
                          Total: {cartTotal.toLocaleString()} XAF
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
                              <span>{(item.price * item.quantity).toLocaleString()} XAF</span>
                            </div>
                          ))}
                          <div className="border-t mt-2 pt-2 font-semibold text-sm">
                            Total: {cartTotal.toLocaleString()} XAF
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
                           disabled={item.quantity >= item.stock}
                         >
                           <Plus size={16} />
                         </Button>
                       </div>
                     </div>
                   ))}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-nack-red">{cartTotal.toLocaleString()} XAF</span>
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
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                    <div>
                      <p className="font-medium text-sm">
                        {sale.items.map(item => `${item.name} x${item.quantity}`).join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleTimeString()} • {sale.paymentMethod === 'card' ? 'Carte' : 'Cash'}
                      </p>
                    </div>
                    <span className="font-semibold text-green-600">
                      +{sale.total.toLocaleString()} XAF
                    </span>
                  </div>
                ))}
                {sales.length === 0 && <p className="text-sm text-muted-foreground">Aucune vente récente</p>}
              </div>
            </CardContent>
          </Card>
        </div>
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