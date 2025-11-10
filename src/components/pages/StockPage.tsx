import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Coffee,
  Wine,
  Pizza,
  Sandwich,
  IceCream,
  Beer,
  GlassWater,
  Cookie,
  Cherry,
  Apple,
  Utensils,
  Settings,
  Wrench,
  Shirt,
  Box,
  ShoppingBag,
  Lightbulb,
  Upload,
  FileText,
  Eye,
  EyeOff
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { lossesColRef, productsColRef } from "@/lib/collections";
import { addDoc, deleteDoc, doc as fsDoc, getDoc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import type { ProductDoc, LossDoc } from "@/types/inventory";
import type { UserProfile } from "@/types/profile";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { deleteImageByToken } from "@/lib/cloudinary";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  cost: number;
  description?: string;
  icon?: string;
  imageUrl?: string;
  formula?: {
    units: number;
    price: number;
  };
}

const StockPage = () => {
  const { toast } = useToast();
  const { user, profile, saveProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formStep, setFormStep] = useState(1); // Étape du formulaire guidé
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'csv' | 'pdf' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Partial<Product>>>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);

  const productsInitializedRef = useRef<string>('');
  const hasReceivedValidProductsRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;
    
    const userKey = user.uid;
    
    // Réinitialiser uniquement si l'utilisateur change
    if (productsInitializedRef.current !== userKey) {
      productsInitializedRef.current = '';
      hasReceivedValidProductsRef.current = false;
      setProducts([]);
    }

    let productsInitialized = false;

    const unsub = onSnapshot(productsColRef(db, user.uid), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const raw = d.data() as Partial<ProductDoc> & Record<string, unknown>;
        const price = Number((raw.price as number | string | undefined) ?? 0) || 0;
        const quantity = Number((raw.quantity as number | string | undefined) ?? 0) || 0;
        const cost = Number((raw.cost as number | string | undefined) ?? 0) || 0;
        const formulaUnits = raw.formula && typeof raw.formula.units !== 'undefined' ? Number(raw.formula.units) || 0 : undefined;
        const formulaPrice = raw.formula && typeof raw.formula.price !== 'undefined' ? Number(raw.formula.price) || 0 : undefined;
        return {
          id: d.id,
          name: (raw.name as string) || "",
          category: (raw.category as string) || "",
          price,
          quantity,
          cost,
          description: (raw.description as string) || undefined,
          icon: (raw.icon as string) || undefined,
          imageUrl: (raw.imageUrl as string) || undefined,
          formula: formulaUnits !== undefined && formulaPrice !== undefined ? { units: formulaUnits, price: formulaPrice } : undefined,
        } as Product;
      });
      
      // Marquer qu'on a reçu des données valides si le snapshot contient des données
      if (list.length > 0) {
        hasReceivedValidProductsRef.current = true;
      }
      
      // Toujours accepter les snapshots du serveur (source de vérité)
      // Mais ignorer les snapshots vides du cache une fois qu'on a reçu des données valides
      const isFromServer = !snap.metadata.fromCache;
      
      // Utiliser une fonction de mise à jour pour préserver les données si nécessaire
      setProducts(prev => {
        // Si c'est du serveur, toujours accepter (source de vérité)
        if (isFromServer) {
          return list;
        }
        
        // Si c'est du cache et qu'on n'a jamais eu de données valides, accepter
        if (!hasReceivedValidProductsRef.current) {
          return list;
        }
        
        // Si c'est du cache, on a déjà des données valides, et le nouveau snapshot est vide : conserver les données précédentes
        if (list.length === 0 && prev.length > 0) {
          return prev;
        }
        
        // Sinon, accepter les nouvelles données
        return list;
      });
      
      if (!productsInitialized) {
        productsInitialized = true;
        if (productsInitializedRef.current !== userKey) {
          productsInitializedRef.current = userKey;
        }
      }
    }, (error) => {
      console.error('Erreur snapshot products:', error);
    });
    
    return () => unsub();
  }, [user]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    price: "",
    quantity: "",
    cost: "",
    description: "",
    icon: "",
    imageUrl: "",
    formulaUnits: "",
    formulaPrice: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [lossData, setLossData] = useState({
    productId: "",
    quantity: "",
    reason: "",
    date: new Date().toISOString().split('T')[0]
  });

  // --- Manager authentication (password prompt) ---
  const [isManagerAuthOpen, setIsManagerAuthOpen] = useState(false);
  const [managerCode, setManagerCode] = useState("");
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [postAuthActionRefState] = useState<null | (() => void)>(null);
  const postAuthActionRef = { current: postAuthActionRefState as undefined | (() => void) } as { current: undefined | (() => void) };
  const [authValidUntil, setAuthValidUntil] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem('nack_manager_auth_until');
      return raw ? Number(raw) : 0;
    } catch { return 0; }
  });

  const rememberAuthWindow = (ms: number) => {
    const until = Date.now() + ms;
    setAuthValidUntil(until);
    try { sessionStorage.setItem('nack_manager_auth_until', String(until)); } catch { /* ignore */ }
  };

  const requireManagerAuth = (action: () => void) => {
    // Si aucun code gérant n'est configuré, pas de vérification requise
    if (!profile?.managerPinHash) { action(); return; }
    if (Date.now() < authValidUntil) { action(); return; }
    postAuthActionRef.current = action;
    setManagerCode("");
    setIsManagerAuthOpen(true);
  };

  const digestSha256Hex = async (text: string): Promise<string> => {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const submitManagerAuth = async () => {
    if (!profile?.managerPinHash) {
      setIsManagerAuthOpen(false);
      const fn = postAuthActionRef.current; postAuthActionRef.current = undefined; if (fn) fn();
      return;
    }
    if (!managerCode) {
      toast({ title: "Code requis", description: "Veuillez saisir votre code gérant.", variant: "destructive" });
      return;
    }
    setIsAuthChecking(true);
    try {
      const hash = await digestSha256Hex(managerCode);
      if (hash !== profile.managerPinHash) throw new Error('bad');
      rememberAuthWindow(10 * 60 * 1000); // 10 minutes
      setIsManagerAuthOpen(false);
      const fn = postAuthActionRef.current; postAuthActionRef.current = undefined; if (fn) fn();
      toast({ title: "Vérification réussie", description: "Vous pouvez modifier le stock pendant 10 minutes." });
    } catch {
      toast({ title: "Code incorrect", description: "Le code gérant ne correspond pas.", variant: "destructive" });
    } finally {
      setIsAuthChecking(false);
    }
  };

  // --- Security code management UI ---
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isSavingCode, setIsSavingCode] = useState(false);
  const digestSha256HexLocal = async (text: string): Promise<string> => {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  };
  const handleSaveSecurityCode = async () => {
    try {
      if (!newCode || !confirmCode) {
        toast({ title: "Champs requis", description: "Saisissez et confirmez le code.", variant: "destructive" });
        return;
      }
      if (newCode !== confirmCode) {
        toast({ title: "Codes différents", description: "Le nouveau code et sa confirmation ne correspondent pas.", variant: "destructive" });
        return;
      }
      if (profile?.managerPinHash) {
        if (!currentCode) {
          toast({ title: "Code actuel requis", description: "Saisissez le code actuel pour le modifier.", variant: "destructive" });
          return;
        }
        const curHash = await digestSha256HexLocal(currentCode);
        if (curHash !== profile.managerPinHash) {
          toast({ title: "Code actuel incorrect", description: "Le code actuel ne correspond pas.", variant: "destructive" });
          return;
        }
      }
      setIsSavingCode(true);
      const newHash = await digestSha256HexLocal(newCode);
      await saveProfile({
        // On ne modifie que le code; saveProfile fait un merge partiel
        managerPinHash: newHash,
      } as Omit<UserProfile, "uid" | "createdAt" | "updatedAt">);
      setIsSecurityDialogOpen(false);
      setCurrentCode(""); setNewCode(""); setConfirmCode("");
      toast({ title: "Sécurité mise à jour", description: "Le code gérant a été enregistré." });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le code pour le moment.", variant: "destructive" });
    } finally {
      setIsSavingCode(false);
    }
  };

  const categories = ["Boissons", "Plats", "Alcools", "Snacks", "Desserts", "Ustensiles", "Équipements", "Fournitures", "Autres"];
  
  const availableIcons = [
    { name: "Beer", icon: Beer, label: "Bière" },
    { name: "Wine", icon: Wine, label: "Vin/Alcool" },
    { name: "Coffee", icon: Coffee, label: "Café" },
    { name: "GlassWater", icon: GlassWater, label: "Boisson" },
    { name: "Pizza", icon: Pizza, label: "Pizza" },
    { name: "Sandwich", icon: Sandwich, label: "Sandwich" },
    { name: "Cookie", icon: Cookie, label: "Snack" },
    { name: "IceCream", icon: IceCream, label: "Dessert" },
    { name: "Cherry", icon: Cherry, label: "Fruit" },
    { name: "Apple", icon: Apple, label: "Pomme" },
    { name: "Utensils", icon: Utensils, label: "Couverts/Ustensiles" },
    { name: "Settings", icon: Settings, label: "Équipement" },
    { name: "Wrench", icon: Wrench, label: "Outils" },
    { name: "Shirt", icon: Shirt, label: "Vêtements/Uniformes" },
    { name: "Box", icon: Box, label: "Cartons/Emballages" },
    { name: "ShoppingBag", icon: ShoppingBag, label: "Sacs" },
    { name: "Lightbulb", icon: Lightbulb, label: "Ampoules/Éclairage" },
    { name: "Package", icon: Package, label: "Général" }
  ];

  const getProductIcon = (iconName?: string) => {
    if (!iconName) return Package;
    const iconItem = availableIcons.find(item => item.name === iconName);
    return iconItem ? iconItem.icon : Package;
  };

  const filteredProducts = products.filter(product => {
    const name = (product.name || "").toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesStock = showZeroStock || (product.quantity ?? 0) > 0;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const lowStockProducts = products.filter(p => (p.quantity ?? 0) <= 10);
  // Calcul explicite de la valeur du stock pour forcer l'affichage dans Chrome
  const totalStockValue = useMemo(() => {
    const value = products.reduce((total, product) => {
      const price = Number(product.price || 0);
      const quantity = Number(product.quantity || 0);
      return total + (price * quantity);
    }, 0);
    return Number(value) || 0;
  }, [products]);

  const handleAddProduct = async () => {
    if (!user) return;
    if (!newProduct.name || !newProduct.category || newProduct.quantity === "") {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires (nom, catégorie, quantité)",
        variant: "destructive"
      });
      return;
    }

    // Validate numbers - price can be 0 for non-sold items (utensils, equipment)
    const priceNum = Number((newProduct.price ?? "").toString().trim() || 0);
    const qtyNum = Number((newProduct.quantity ?? "").toString().trim());
    const costNum = Number((newProduct.cost ?? "").toString().trim() || 0);
    if (Number.isNaN(priceNum) || Number.isNaN(qtyNum) || priceNum < 0 || qtyNum < 0 || costNum < 0) {
      toast({ title: "Valeurs invalides", description: "Prix, quantité et coût doivent être des nombres positifs.", variant: "destructive" });
      return;
    }

    setIsSavingProduct(true);
    try {
    let finalImageUrl: string | undefined = newProduct.imageUrl || undefined;
    let finalDeleteToken: string | undefined;
    if (imageFile) {
      try {
        const up = await uploadImageToCloudinaryDetailed(imageFile, "products");
        finalImageUrl = up.url;
        finalDeleteToken = up.deleteToken;
      } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Échec de l'upload";
          // Ne pas bloquer l'ajout du produit si Cloudinary n'est pas configuré ou si l'upload échoue
          toast({ title: "Image non ajoutée", description: msg + ". Le produit sera ajouté sans image.", variant: "destructive" });
      }
    }

    const payload: ProductDoc = {
      name: newProduct.name,
      category: newProduct.category,
        price: priceNum,
        quantity: qtyNum,
        cost: costNum,
        ...(newProduct.description ? { description: newProduct.description } : {}),
        ...(newProduct.icon ? { icon: newProduct.icon } : {}),
        ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
        ...(finalDeleteToken ? { imageDeleteToken: finalDeleteToken } : {}),
        ...(newProduct.formulaUnits && newProduct.formulaPrice ? {
          formula: {
        units: Number(newProduct.formulaUnits),
        price: Number(newProduct.formulaPrice)
          }
        } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

      await addDoc(productsColRef(db, user.uid), payload as ProductDoc);

    setNewProduct({ 
      name: "", 
      category: "", 
      price: "", 
      quantity: "", 
      cost: "", 
      description: "",
      icon: "",
      imageUrl: "",
      formulaUnits: "",
      formulaPrice: ""
    });
    setImageFile(null);
    setIsAddModalOpen(false);
      toast({ title: "Produit ajouté", description: `${payload.name} a été ajouté au stock avec succès` });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      // Affiche les infos d'erreur détaillées pour debug (console seulement)
      console.error("Add product failed:", e);
      toast({ title: "Échec de l'ajout", description: message || "Vérifiez votre connexion et vos permissions.", variant: "destructive" });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const openEditProductUnsafe = (product: Product) => {
    setEditingProduct(product);
    setImageFile(null); // Réinitialiser le fichier image lors de l'ouverture
    setNewProduct({
      name: product.name,
      category: product.category,
      price: String(product.price),
      quantity: String(product.quantity),
      cost: String(product.cost),
      description: product.description || "",
      icon: product.icon || "",
      imageUrl: product.imageUrl || "",
      formulaUnits: product.formula?.units ? String(product.formula.units) : "",
      formulaPrice: product.formula?.price ? String(product.formula.price) : "",
    });
    setIsAddModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    requireManagerAuth(() => openEditProductUnsafe(product));
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user) return;
    try {
      const ref = fsDoc(productsColRef(db, user.uid), id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as ProductDoc;
        if (data.imageDeleteToken) {
          try { await deleteImageByToken(data.imageDeleteToken); } catch { /* ignore */ }
        }
      }
      await deleteDoc(ref);
      toast({ title: "Produit supprimé", description: "Le produit a été retiré du stock" });
    } catch (e: unknown) {
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Suppression échouée", variant: "destructive" });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id || '').filter(Boolean)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedProducts.size === 0) return;
    
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer ${selectedProducts.size} produit(s) ? Cette action est irréversible.`;
    if (!window.confirm(confirmMessage)) return;

    setIsDeletingMultiple(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const productId of selectedProducts) {
        try {
          const ref = fsDoc(productsColRef(db, user.uid), productId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as ProductDoc;
            if (data.imageDeleteToken) {
              try { await deleteImageByToken(data.imageDeleteToken); } catch { /* ignore */ }
            }
          }
          await deleteDoc(ref);
          successCount++;
        } catch (e) {
          console.error('Erreur suppression produit:', productId, e);
          errorCount++;
        }
      }
      
      setSelectedProducts(new Set());
      toast({ 
        title: "Suppression terminée", 
        description: `${successCount} produit(s) supprimé(s)${errorCount > 0 ? `. ${errorCount} erreur(s).` : '.'}` 
      });
    } catch (e: unknown) {
      toast({ 
        title: "Erreur", 
        description: e instanceof Error ? e.message : "Suppression échouée", 
        variant: "destructive" 
      });
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!user || !editingProduct) return;

    // Utiliser les valeurs du formulaire (newProduct) et non l'instantané initial (editingProduct)
    if (!newProduct.name || !newProduct.category || newProduct.price === "" || newProduct.quantity === "") {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const priceNum = Number(newProduct.price);
    const qtyNum = Number(newProduct.quantity);
    const costNum = Number(newProduct.cost || 0);
    if (Number.isNaN(priceNum) || Number.isNaN(qtyNum) || priceNum < 0 || qtyNum < 0 || costNum < 0) {
      toast({ title: "Valeurs invalides", description: "Prix, quantité et coût doivent être des nombres positifs.", variant: "destructive" });
      return;
    }

    try {
      const productRef = fsDoc(productsColRef(db, user.uid), editingProduct.id);
      
      // Gérer l'upload de la nouvelle image si un fichier est sélectionné
      let finalImageUrl: string | undefined = newProduct.imageUrl || editingProduct.imageUrl || undefined;
      let finalDeleteToken: string | undefined;
      
      if (imageFile) {
        try {
          // Supprimer l'ancienne image si elle existe
          if (editingProduct.imageUrl) {
            const currentDoc = await getDoc(productRef);
            if (currentDoc.exists()) {
              const currentData = currentDoc.data() as ProductDoc;
              if (currentData.imageDeleteToken) {
                try { 
                  await deleteImageByToken(currentData.imageDeleteToken); 
                } catch (e) { 
                  console.warn('Erreur suppression ancienne image:', e);
                }
              }
            }
          }
          
          // Uploader la nouvelle image
          const up = await uploadImageToCloudinaryDetailed(imageFile, "products");
          finalImageUrl = up.url;
          finalDeleteToken = up.deleteToken;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Échec de l'upload";
          toast({ 
            title: "Image non mise à jour", 
            description: msg + ". Le produit sera mis à jour sans changer l'image.", 
            variant: "destructive" 
          });
          // Garder l'ancienne image en cas d'échec
          finalImageUrl = editingProduct.imageUrl || newProduct.imageUrl || undefined;
        }
      }
      
      const payload: Partial<ProductDoc> = {
        name: newProduct.name,
        category: newProduct.category,
        price: priceNum,
        quantity: qtyNum,
        ...(newProduct.cost !== "" ? { cost: costNum } : {}),
        ...(newProduct.description ? { description: newProduct.description } : {}),
        ...(newProduct.icon ? { icon: newProduct.icon } : {}),
        ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
        ...(finalDeleteToken ? { imageDeleteToken: finalDeleteToken } : {}),
        ...(newProduct.formulaUnits && newProduct.formulaPrice ? {
          formula: {
            units: Number(newProduct.formulaUnits),
            price: Number(newProduct.formulaPrice)
          }
        } : {}),
        updatedAt: Date.now(),
      };
      await updateDoc(productRef, payload);

      setIsAddModalOpen(false);
      setEditingProduct(null);
      setImageFile(null);
      setNewProduct({
        name: "",
        category: "",
        price: "",
        quantity: "",
        cost: "",
        description: "",
        icon: "",
        imageUrl: "",
        formulaUnits: "",
        formulaPrice: ""
      });
      toast({ title: "Produit modifié", description: "Le produit a été mis à jour" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  // Fonction pour parser CSV (gère les guillemets et virgules dans les valeurs)
  const parseCSV = (text: string): Array<Partial<Product>> => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Fonction pour parser une ligne CSV en tenant compte des guillemets
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Guillemet échappé
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Fin de champ
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Ajouter le dernier champ
      result.push(current.trim());
      return result;
    };
    
    // Détecter l'en-tête (première ligne)
    const firstLine = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
    const header = firstLine.map(h => h.toLowerCase());
    
    // Détection flexible des colonnes avec plusieurs variantes
    const nameIdx = header.findIndex(h => 
      h.includes('nom') || h.includes('name') || h.includes('produit') || 
      h.includes('libellé') || h.includes('libelle') || h.includes('article') ||
      h === 'nom' || h === 'name' || h === 'produit' || h === 'article'
    );
    const categoryIdx = header.findIndex(h => 
      h.includes('catégorie') || h.includes('category') || h.includes('categorie') ||
      h.includes('type') || h === 'catégorie' || h === 'category' || h === 'type'
    );
    const priceIdx = header.findIndex(h => 
      h.includes('prix') || h.includes('price') || h.includes('tarif') ||
      h === 'prix' || h === 'price' || h === 'tarif'
    );
    const quantityIdx = header.findIndex(h => 
      h.includes('quantité') || h.includes('quantity') || h.includes('quantite') || 
      h.includes('stock') || h.includes('qte') || h.includes('qty') ||
      h === 'quantité' || h === 'quantity' || h === 'stock' || h === 'qte'
    );
    const costIdx = header.findIndex(h => 
      h.includes('coût') || h.includes('cost') || h.includes('cout') ||
      h.includes('prix d\'achat') || h.includes('prix achat') ||
      h === 'coût' || h === 'cost' || h === 'cout'
    );
    const descriptionIdx = header.findIndex(h => 
      h.includes('description') || h.includes('desc') || h.includes('détail') ||
      h === 'description' || h === 'desc'
    );
    
    // Si pas d'en-tête détecté, essayer un format sans en-tête (colonnes par position)
    const hasHeader = nameIdx >= 0 || (header.length > 0 && isNaN(parseFloat(header[0])));
    let startRow = 1;
    
    // Si pas de colonne nom trouvée, essayer format sans en-tête
    if (nameIdx < 0 && lines.length > 1) {
      // Essayer de détecter si la première ligne est un en-tête ou des données
      const firstDataLine = parseCSVLine(lines[1] || lines[0]);
      if (firstDataLine.length >= 2) {
        // Format sans en-tête: colonne 0 = nom, colonne 1 = catégorie, colonne 2 = prix, colonne 3 = quantité
        startRow = 0;
        console.log('Format CSV sans en-tête détecté, utilisation de l\'ordre: Nom, Catégorie, Prix, Quantité');
      }
    }
    
    const products: Array<Partial<Product>> = [];
    
    // Parser les lignes de données
    for (let i = startRow; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
      
      // Si format sans en-tête, utiliser les positions par défaut
      let name = '';
      let category = 'Autres';
      let price = 0;
      let quantity = 0;
      let cost = 0;
      let description: string | undefined = undefined;
      
      if (nameIdx >= 0) {
        // Format avec en-tête
        name = values[nameIdx] || '';
        category = (categoryIdx >= 0 && values[categoryIdx]) ? values[categoryIdx] : 'Autres';
        price = priceIdx >= 0 ? parseFloat(values[priceIdx] || '0') : 0;
        quantity = quantityIdx >= 0 ? parseFloat(values[quantityIdx] || '0') : 0;
        cost = costIdx >= 0 ? parseFloat(values[costIdx] || '0') : 0;
        description = descriptionIdx >= 0 ? values[descriptionIdx] : undefined;
      } else if (values.length >= 1) {
        // Format sans en-tête: utiliser l'ordre par défaut
        name = values[0] || '';
        category = values[1] || 'Autres';
        price = values[2] ? parseFloat(values[2]) : 0;
        quantity = values[3] ? parseFloat(values[3]) : 0;
        cost = values[4] ? parseFloat(values[4]) : 0;
        description = values[5];
      }
      
      // Nettoyer le nom et vérifier qu'il n'est pas vide
      name = name.trim();
      
      if (name && name.length > 0) {
        // Si quantité n'est pas spécifiée, mettre 0 (sera modifiable après)
        const finalQuantity = isNaN(quantity) ? 0 : Math.max(0, Math.floor(quantity));
        const finalPrice = isNaN(price) ? 0 : Math.max(0, price);
        const finalCost = isNaN(cost) ? 0 : Math.max(0, cost);
        
        products.push({
          name,
          category: category.trim() || 'Autres',
          price: finalPrice,
          quantity: finalQuantity,
          cost: finalCost,
          description: description?.trim()
        });
      }
    }
    
    // Debug: afficher les colonnes détectées
    if (products.length === 0 && lines.length > 0) {
      console.log('Colonnes détectées:', header);
      console.log('Indices:', { nameIdx, categoryIdx, priceIdx, quantityIdx, costIdx });
      console.log('Première ligne de données:', parseCSVLine(lines[startRow] || lines[0]));
    }
    
    return products;
  };

  // Fonction pour parser PDF (basique - extraction de texte)
  const parsePDF = async (file: File): Promise<Array<Partial<Product>>> => {
    // Pour le PDF, on va utiliser une approche simple avec une bibliothèque
    // Pour l'instant, on va suggérer d'utiliser CSV ou une conversion manuelle
    // On peut utiliser pdfjs-dist si nécessaire, mais pour simplifier, on va d'abord implémenter CSV
    throw new Error('L\'import PDF nécessite une bibliothèque spécialisée. Veuillez convertir votre PDF en CSV d\'abord.');
  };

  // Gérer le changement de fichier
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    
    // Détecter le type de fichier
    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
      setImportType('csv');
      try {
        const text = await file.text();
        const parsed = parseCSV(text);
        setImportPreview(parsed);
        
        if (parsed.length === 0) {
          toast({
            title: "Aucun produit détecté",
            description: "Vérifiez que votre CSV contient les colonnes: Nom, Catégorie, Prix, Quantité. Consultez la console pour plus de détails.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Erreur parsing CSV:', error);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de lire le fichier CSV. Vérifiez le format.",
          variant: "destructive"
        });
        setImportFile(null);
        setImportType(null);
      }
    } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      setImportType('pdf');
      try {
        // Pour PDF, on va afficher un message d'aide
        toast({
          title: "Import PDF",
          description: "L'import PDF est en cours de développement. Veuillez convertir votre PDF en CSV pour l'instant.",
          variant: "destructive"
        });
        setImportFile(null);
        setImportType(null);
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de lire le fichier PDF. Veuillez utiliser un fichier CSV.",
          variant: "destructive"
        });
        setImportFile(null);
        setImportType(null);
      }
    } else {
      toast({
        title: "Format non supporté",
        description: "Veuillez sélectionner un fichier CSV ou PDF.",
        variant: "destructive"
      });
      setImportFile(null);
      setImportType(null);
    }
  };

  // Importer les produits
  const handleImportProducts = async () => {
    if (!user || !importPreview.length) return;
    
    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const product of importPreview) {
        // Accepter les produits même avec quantité 0 (sera modifiable après)
        if (!product.name || !product.category) {
          errorCount++;
          continue;
        }
        
        // Si quantité n'est pas définie, mettre 0 par défaut
        if (product.quantity === undefined) {
          product.quantity = 0;
        }
        
        try {
          const payload: ProductDoc = {
            name: product.name,
            category: product.category,
            price: product.price || 0,
            quantity: product.quantity || 0,
            cost: product.cost || 0,
            ...(product.description ? { description: product.description } : {}),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          
          await addDoc(productsColRef(db, user.uid), payload as ProductDoc);
          successCount++;
        } catch (error) {
          console.error('Erreur import produit:', error);
          errorCount++;
        }
      }
      
      toast({
        title: "Import terminé",
        description: `${successCount} produit(s) importé(s) avec succès${errorCount > 0 ? `. ${errorCount} erreur(s).` : '.'} Vous pouvez maintenant les modifier et ajouter des images comme les autres produits.`
      });
      
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview([]);
      setImportType(null);
    } catch (error) {
      toast({
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRecordLoss = async () => {
    if (!user) return;
    if (!lossData.productId || !lossData.quantity || !lossData.reason) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const lossQuantity = Number(lossData.quantity);

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = fsDoc(productsColRef(db, user.uid), lossData.productId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Produit introuvable");
        const product = productSnap.data() as Product;
        if (lossQuantity > product.quantity) throw new Error("La quantité de perte dépasse le stock");
        transaction.update(productRef, { quantity: product.quantity - lossQuantity, updatedAt: Date.now() });
        const lossRefParent = lossesColRef(db, user.uid);
        await transaction.set(fsDoc(lossRefParent), {
          productId: lossData.productId,
          productName: product.name,
          quantity: lossQuantity,
          reason: lossData.reason,
          date: lossData.date,
          cost: product.cost * lossQuantity,
          createdAt: Date.now(),
        } as LossDoc);
      });

      setLossData({
        productId: "",
        quantity: "",
        reason: "",
        date: new Date().toISOString().split('T')[0]
      });
      setIsLossModalOpen(false);

      toast({
        title: "Perte enregistrée",
        description: `${lossQuantity} unité(s) enregistrée(s) en perte`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produits</p>
                <p className="text-2xl font-bold" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                  {Number(products.length || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Package size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valeur du Stock</p>
                <p className="text-2xl font-bold force-display">
                  {String(totalStockValue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }))} XAF
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <DollarSign size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Faible</p>
                <p className="text-2xl font-bold text-red-600" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                  {Number(lowStockProducts.length || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Gestion du Stock</CardTitle>
              <CardDescription>Gérez vos produits et surveillez les stocks</CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
               <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     className="w-full sm:w-auto bg-gradient-primary text-white shadow-button hover:shadow-elegant"
                     onClick={() => {
                       requireManagerAuth(() => {
                         setEditingProduct(null);
                         setNewProduct({
                           name: "", category: "", price: "", quantity: "", cost: "",
                           description: "", icon: "", imageUrl: "", formulaUnits: "", formulaPrice: ""
                         });
                         setIsAddModalOpen(true);
                       });
                     }}
                   >
                     <Plus className="mr-2" size={18} />
                     Ajouter un produit
                   </Button>
                 </DialogTrigger>
               </Dialog>
               
               {/* Bouton Import */}
               <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline"
                     className="w-full sm:w-auto"
                     onClick={() => {
                       setImportFile(null);
                       setImportPreview([]);
                       setImportType(null);
                       setIsImportModalOpen(true);
                     }}
                   >
                     <Upload className="mr-2" size={18} />
                     Importer
                   </Button>
                 </DialogTrigger>
                   <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                     <DialogHeader>
                       <DialogTitle className="text-2xl font-bold">Importer des produits</DialogTitle>
                       <DialogDescription>
                         Importez vos produits depuis un fichier CSV ou PDF. Les produits importés peuvent être modifiés et complétés (images, icônes, etc.) comme les produits créés manuellement.
                       </DialogDescription>
                     </DialogHeader>
                     <div className="space-y-6 py-4">
                       <div>
                         <Label htmlFor="importFile" className="text-lg font-semibold mb-3 block">
                           Sélectionner un fichier
                         </Label>
                         <Input
                           id="importFile"
                           type="file"
                           accept=".csv,.pdf,text/csv,application/pdf"
                           onChange={handleFileChange}
                           className="h-14 text-lg"
                         />
                         <p className="text-sm text-muted-foreground mt-2">
                           Formats supportés: CSV, PDF. Pour CSV, utilisez les colonnes: <strong>Nom</strong>, <strong>Catégorie</strong>, <strong>Prix</strong>, <strong>Quantité</strong>, Coût (optionnel), Description (optionnel)
                         </p>
                         <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                           <p className="text-xs font-semibold text-blue-900 mb-1">Exemple de format CSV (avec en-tête):</p>
                           <pre className="text-xs text-blue-800 overflow-x-auto whitespace-pre-wrap">
{`Nom,Catégorie,Prix,Quantité,Coût,Description
"Bière 33cl","Boissons",1500,50,1000,"Bière locale"
"Vin rouge","Alcools",5000,20,3500,"Vin importé"`}
                           </pre>
                           <p className="text-xs font-semibold text-blue-900 mb-1 mt-3">Ou sans en-tête (ordre: Nom, Catégorie, Prix, Quantité):</p>
                           <pre className="text-xs text-blue-800 overflow-x-auto whitespace-pre-wrap">
{`"Bière 33cl","Boissons",1500,50
"Vin rouge","Alcools",5000,20`}
                           </pre>
                           <p className="text-xs text-blue-700 mt-2">
                             💡 Les noms de colonnes acceptés: Nom/Name/Produit, Catégorie/Category/Type, Prix/Price/Tarif, Quantité/Quantity/Stock/Qte
                           </p>
                         </div>
                       </div>
                       
                       {importFile && importPreview.length === 0 && importType === 'csv' && (
                         <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                           <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Aucun produit détecté</p>
                           <p className="text-xs text-yellow-800 mb-2">
                             Vérifiez que votre CSV contient au moins une colonne avec le nom du produit.
                             Ouvrez la console du navigateur (F12) pour voir les détails de détection.
                           </p>
                           <p className="text-xs text-yellow-800">
                             <strong>Format attendu:</strong> Colonne "Nom" ou "Name" ou "Produit" (ou format sans en-tête: première colonne = nom)
                           </p>
                         </div>
                       )}
                       
                       {importPreview.length > 0 && (
                         <div>
                           <Label className="text-lg font-semibold mb-3 block">
                             Aperçu ({importPreview.length} produit(s) détecté(s))
                           </Label>
                           <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-2">
                             {importPreview.slice(0, 10).map((product, idx) => (
                               <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                                 <div>
                                   <p className="font-medium">{product.name || 'Sans nom'}</p>
                                   <p className="text-sm text-muted-foreground">
                                     {product.category || 'Autres'} • Qté: {product.quantity || 0} • Prix: {product.price || 0} XAF
                                   </p>
                                 </div>
                                 {(!product.name || product.quantity === undefined) && (
                                   <Badge variant="destructive">Incomplet</Badge>
                                 )}
                               </div>
                             ))}
                             {importPreview.length > 10 && (
                               <p className="text-sm text-muted-foreground text-center">
                                 ... et {importPreview.length - 10} autre(s) produit(s)
                               </p>
                             )}
                           </div>
                         </div>
                       )}
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t">
                       <Button 
                         variant="outline" 
                         onClick={() => {
                           setIsImportModalOpen(false);
                           setImportFile(null);
                           setImportPreview([]);
                           setImportType(null);
                         }}
                         className="h-11 px-6"
                       >
                         Annuler
                       </Button>
                       <Button 
                         onClick={handleImportProducts}
                         disabled={isImporting || importPreview.length === 0}
                         className="bg-gradient-primary text-white h-11 px-6"
                       >
                         {isImporting ? 'Import en cours...' : `Importer ${importPreview.length} produit(s)`}
                       </Button>
                     </div>
                   </DialogContent>
                 </Dialog>
                 
                 {/* Bouton Sécurité */}
                 <Button 
                   variant="outline"
                   onClick={() => setIsSecurityDialogOpen(true)}
                   className="w-full sm:w-auto"
                 >
                   Sécurité
                 </Button>
                 <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" onOpenAutoFocus={() => setFormStep(1)}>
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-2xl font-bold text-center">{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
                    <DialogDescription className="text-base text-center">
                      Étape {formStep} sur 3
                    </DialogDescription>
                    {/* Barre de progression */}
                    <div className="flex gap-2 mt-4">
                      <div className={`h-2 flex-1 rounded-full ${formStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <div className={`h-2 flex-1 rounded-full ${formStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <div className={`h-2 flex-1 rounded-full ${formStep >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                  </DialogHeader>
                  <div className="space-y-6 py-4 min-h-[400px]">
                    {/* ÉTAPE 1: Choisir la catégorie */}
                    {formStep === 1 && (
                      <div className="space-y-6">
                        <h3 className="text-2xl font-bold text-center">Qu'est-ce que c'est ?</h3>
                        <p className="text-center text-muted-foreground text-lg">Choisissez le type de produit</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[
                            { cat: "Boissons", icon: GlassWater, color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
                            { cat: "Plats", icon: Pizza, color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
                            { cat: "Alcools", icon: Wine, color: "bg-purple-50 border-purple-200 hover:bg-purple-100" },
                            { cat: "Snacks", icon: Cookie, color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
                            { cat: "Desserts", icon: IceCream, color: "bg-pink-50 border-pink-200 hover:bg-pink-100" },
                            { cat: "Ustensiles", icon: Utensils, color: "bg-gray-50 border-gray-200 hover:bg-gray-100" },
                            { cat: "Équipements", icon: Settings, color: "bg-green-50 border-green-200 hover:bg-green-100" },
                            { cat: "Fournitures", icon: Box, color: "bg-teal-50 border-teal-200 hover:bg-teal-100" },
                            { cat: "Autres", icon: Package, color: "bg-slate-50 border-slate-200 hover:bg-slate-100" }
                          ].map(({ cat, icon: Icon, color }) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setNewProduct({...newProduct, category: cat});
                                setFormStep(2);
                              }}
                              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 transition-all ${color} ${newProduct.category === cat ? 'ring-4 ring-green-500' : ''}`}
                            >
                              <Icon size={48} className="text-gray-700" />
                              <span className="text-lg font-semibold">{cat}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ÉTAPE 2: Nom et Icône */}
                    {formStep === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-2xl font-bold text-center">Comment ça s'appelle ?</h3>
                        <p className="text-center text-muted-foreground">Catégorie : <strong>{newProduct.category}</strong></p>
                        
                        <div>
                          <Label htmlFor="name" className="text-xl font-semibold mb-3 block text-center">Nom du produit</Label>
                          <Input
                            id="name"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            className="w-full h-16 text-2xl text-center font-semibold"
                            placeholder="Tapez le nom ici..."
                            autoFocus
                          />
                        </div>

                        <div>
                          <Label className="text-xl font-semibold mb-3 block text-center">Choisir une icône</Label>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                            {availableIcons.map(({ name, icon: Icon, label }) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setNewProduct({...newProduct, icon: name})}
                                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-gray-50 ${newProduct.icon === name ? 'ring-4 ring-green-500 bg-green-50' : 'bg-white'}`}
                                title={label}
                              >
                                <Icon size={32} />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="productImage" className="text-lg font-semibold mb-3 block text-center">Photo (optionnel)</Label>
                          <Input id="productImage" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="h-14 text-lg" />
                        </div>
                      </div>
                    )}

                    {/* ÉTAPE 3: Quantité et Prix */}
                    {formStep === 3 && (
                      <div className="space-y-6">
                        <h3 className="text-2xl font-bold text-center">Prix et Quantité</h3>
                        <p className="text-center text-lg"><strong>{newProduct.name}</strong></p>

                        {/* Hint volontairement retiré pour éviter la confusion. Le prix peut rester vide. */}

                        <div>
                          <Label htmlFor="quantity" className="text-xl font-semibold mb-3 block text-center">Combien vous en avez ?</Label>
                          <Input
                            id="quantity"
                            type="number"
                            value={newProduct.quantity}
                            onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
                            className="w-full h-20 text-4xl text-center font-bold"
                            placeholder=""
                            min="0"
                          />
                        </div>

                        <div>
                          <Label htmlFor="price" className="text-xl font-semibold mb-3 block text-center">Prix de vente (XAF)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                            className="w-full h-20 text-4xl text-center font-bold"
                            placeholder=""
                            min="0"
                          />
                          <p className="text-center text-sm text-muted-foreground mt-2">Laisser vide si non vendu.</p>
                        </div>

                        <div>
                          <Label htmlFor="cost" className="text-lg font-medium mb-3 block text-center">Coût d'achat (optionnel)</Label>
                          <Input
                            id="cost"
                            type="number"
                            value={newProduct.cost}
                            onChange={(e) => setNewProduct({...newProduct, cost: e.target.value})}
                            className="w-full h-16 text-2xl text-center font-semibold"
                            placeholder=""
                            min="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
                    {formStep > 1 ? (
                      <Button 
                        variant="outline" 
                        onClick={() => setFormStep(formStep - 1)}
                        className="h-14 px-8 text-lg font-semibold"
                      >
                        Retour
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => setIsAddModalOpen(false)}
                        className="h-14 px-8 text-lg"
                      >
                        Annuler
                      </Button>
                    )}
                    
                    {formStep < 3 ? (
                      <Button 
                        onClick={() => setFormStep(formStep + 1)}
                        disabled={formStep === 1 && !newProduct.category}
                        className="bg-gradient-primary text-white h-14 px-8 text-lg font-semibold"
                      >
                        Suivant
                      </Button>
                    ) : (
                      <Button 
                        onClick={editingProduct ? handleUpdateProduct : handleAddProduct} 
                        disabled={isSavingProduct || !newProduct.name || !newProduct.quantity}
                        className="bg-green-600 hover:bg-green-700 text-white h-14 px-8 text-lg font-bold"
                      >
                        {isSavingProduct ? 'Sauvegarde...' : 'Enregistrer'}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
               <Dialog open={isLossModalOpen} onOpenChange={setIsLossModalOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline" 
                     className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50"
                     onClick={() => {
                       setIsLossModalOpen(true);
                     }}
                   >
                     <TrendingDown className="mr-2" size={18} />
                     Perte
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                   <DialogHeader className="pb-4">
                     <DialogTitle className="text-xl font-bold">Enregistrer une perte</DialogTitle>
                     <DialogDescription className="text-base">
                       Sélectionnez le produit et la quantité perdue pour mettre à jour le stock.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="space-y-6 py-4">
                     <div>
                       <Label htmlFor="product" className="text-sm font-medium mb-2 block">Produit concerné *</Label>
                       <Select
                         value={lossData.productId}
                         onValueChange={(value) => setLossData({...lossData, productId: value})}
                       >
                         <SelectTrigger className="w-full h-11 text-base bg-background">
                           <SelectValue placeholder="Sélectionner un produit" />
                         </SelectTrigger>
                         <SelectContent className="bg-background border shadow-lg z-50 max-h-60 overflow-y-auto">
                           {products.map(product => (
                             <SelectItem key={product.id} value={product.id} className="text-base py-3 cursor-pointer hover:bg-muted">
                               <div className="flex flex-col items-start">
                                 <span className="font-medium">{product.name}</span>
                                 <span className="text-sm text-muted-foreground">Stock disponible: {product.quantity}</span>
                               </div>
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                     <div>
                       <Label htmlFor="lossQuantity" className="text-sm font-medium mb-2 block">Quantité perdue *</Label>
                       <Input
                         id="lossQuantity"
                         type="number"
                         value={lossData.quantity}
                         onChange={(e) => setLossData({...lossData, quantity: e.target.value})}
                         className="w-full h-11 text-base"
                         placeholder="Nombre d'unités perdues"
                         min="1"
                       />
                     </div>

                     <div>
                       <Label htmlFor="reason" className="text-sm font-medium mb-2 block">Raison de la perte *</Label>
                       <Select
                         value={lossData.reason}
                         onValueChange={(value) => setLossData({...lossData, reason: value})}
                       >
                         <SelectTrigger className="w-full h-11 text-base bg-background">
                           <SelectValue placeholder="Sélectionner une raison" />
                         </SelectTrigger>
                         <SelectContent className="bg-background border shadow-lg z-50">
                           <SelectItem value="expired" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Produit expiré
                           </SelectItem>
                           <SelectItem value="damaged" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Produit endommagé
                           </SelectItem>
                           <SelectItem value="theft" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Vol
                           </SelectItem>
                           <SelectItem value="error" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Erreur d'inventaire
                           </SelectItem>
                           <SelectItem value="other" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Autre
                           </SelectItem>
                         </SelectContent>
                       </Select>
                     </div>

                     <div>
                       <Label htmlFor="date" className="text-sm font-medium mb-2 block">Date de la perte</Label>
                       <Input
                         id="date"
                         type="date"
                         value={lossData.date}
                         onChange={(e) => setLossData({...lossData, date: e.target.value})}
                         className="w-full h-11 text-base"
                       />
                     </div>
                   </div>
                   <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                     <Button 
                       variant="outline" 
                       onClick={() => setIsLossModalOpen(false)}
                       className="h-11 px-6 text-base"
                     >
                       Annuler
                     </Button>
                     <Button 
                       onClick={handleRecordLoss} 
                       variant="destructive"
                       className="h-11 px-6 text-base font-medium"
                     >
                       Enregistrer la perte
                     </Button>
                   </div>
                 </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showZeroStock ? "default" : "outline"}
              onClick={() => setShowZeroStock(!showZeroStock)}
              className="w-full md:w-auto"
              title={showZeroStock ? "Masquer les produits avec quantité 0" : "Afficher les produits avec quantité 0"}
            >
              {showZeroStock ? (
                <>
                  <EyeOff size={16} className="mr-2" />
                  Masquer stock 0
                </>
              ) : (
                <>
                  <Eye size={16} className="mr-2" />
                  Afficher stock 0
                </>
              )}
            </Button>
          </div>

          {/* Sélection multiple */}
          {products.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  id="select-all"
                  checked={filteredProducts.length > 0 && selectedProducts.size > 0 && selectedProducts.size === filteredProducts.filter(p => p.id).length}
                  onCheckedChange={handleSelectAll}
                  disabled={filteredProducts.length === 0}
                />
                <label 
                  htmlFor="select-all" 
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {filteredProducts.length > 0 ? (
                    <>Tout sélectionner ({selectedProducts.size} sélectionné{selectedProducts.size > 1 ? 's' : ''})</>
                  ) : (
                    <>Aucun produit à sélectionner</>
                  )}
                </label>
              </div>
              {selectedProducts.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={isDeletingMultiple}
                  className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                >
                  <Trash2 size={16} className="mr-2" />
                  {isDeletingMultiple ? "Suppression..." : `Supprimer ${selectedProducts.size} produit(s)`}
                </Button>
              )}
            </div>
          )}

          {/* Products List - Card Style */}
          <div className="flex flex-col gap-4">
            {filteredProducts.map((product) => {
              const stockColor = product.quantity > 20 ? "#34C759" : product.quantity > 10 ? "#FF9500" : "#FF3B30";
              const stockPercentage = Math.min((product.quantity / 50) * 100, 100);
              const isLowStock = product.quantity <= 10;

              return (
                <div key={product.id} className={`relative flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-lg border transition ${selectedProducts.has(product.id || '') ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:shadow-2xl'}`}>
                  {(() => {
                    const c = (product.category || '').toLowerCase();
                    const color = c.includes('vin') || c.includes('alcool') ? 'bg-red-500'
                      : c.includes('biere') || c.includes('boisson') ? 'bg-yellow-500'
                      : c.includes('cafe') ? 'bg-purple-500'
                      : c.includes('eau') ? 'bg-blue-500'
                      : c.includes('jus') ? 'bg-orange-500'
                      : c.includes('soda') ? 'bg-green-500'
                      : c.includes('dessert') || c.includes('glace') ? 'bg-pink-500'
                      : 'bg-gray-200';
                    return <div className={`absolute left-0 top-0 h-1 w-full rounded-t-2xl ${color}`} />;
                  })()}
                  {/* Product Header */}
                  <div className="flex items-center gap-4">
                    {product.id && (
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                        className="shrink-0"
                      />
                    )}
                    <div
                      className="aspect-square size-20 shrink-0 rounded-xl bg-cover bg-center bg-no-repeat"
                      style={{
                        backgroundImage: product.imageUrl
                          ? `url(${product.imageUrl})`
                          : "linear-gradient(135deg, #f5f2f0 0%, #e6dfdb 100%)",
                      }}
                    >
                      {!product.imageUrl && (
                        <div className="flex h-full w-full items-center justify-center">
                          {(() => {
                            const IconComponent = getProductIcon(product.icon);
                            return <IconComponent size={32} className="text-[#8a7260]" />;
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-medium leading-normal text-[#181411]">
                          {product.name}
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 w-7 p-0">
                          <Edit size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <p className="text-sm font-normal leading-normal text-[#8a7260]">
                        {product.category}
                      </p>
                      {product.formula && (
                        <p className="text-xs text-[#8a7260] mt-1" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                          Formule: {product.formula.units} unités à <span className="force-display-inline">{String(Number(product.formula.price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }))}</span> XAF
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stock Controls */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-1 flex-col gap-2">
                      {/* Progress Bar */}
                      <div className="h-2 rounded-full bg-[#e6dfdb]">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${stockPercentage}%`,
                            backgroundColor: stockColor,
                          }}
                        />
                      </div>
                      {/* Quantity */}
                      <p
                        className="text-right text-lg font-bold"
                        style={{
                          color: isLowStock ? stockColor : "#181411",
                        }}
                      >
                        {product.quantity}
                      </p>
                    </div>

                    {/* Afficher le bouton + uniquement si un code gérant est configuré */}
                    {profile?.managerPinHash && (
                      <button
                        onClick={() => {
                          requireManagerAuth(() => {
                            if (user) {
                              updateDoc(fsDoc(productsColRef(db, user.uid), product.id), {
                                quantity: product.quantity + 1,
                              });
                            }
                          });
                        }}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-3xl font-light text-white transition-transform active:scale-95 shadow"
                        style={{ backgroundColor: stockColor }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {/* Manager Auth Dialog (Optionnel) */}
      <Dialog open={isManagerAuthOpen} onOpenChange={setIsManagerAuthOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vérification du gérant</DialogTitle>
            <DialogDescription>
              Saisissez votre <strong>code gérant</strong> pour autoriser l'ajout/la modification du stock.<br/>
              Ce code n’est <strong>pas</strong> votre mot de passe de compte. Il est <strong>optionnel</strong> et utile si vous partagez le compte gérant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="mgr-code">Code gérant</Label>
            <Input id="mgr-code" type="password" value={managerCode} onChange={(e) => setManagerCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsManagerAuthOpen(false)}>Annuler</Button>
            <Button onClick={submitManagerAuth} disabled={isAuthChecking} className="bg-gradient-primary text-white">
              {isAuthChecking ? 'Vérification…' : 'Vérifier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Code Dialog */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Sécuriser le stock (code gérant)</DialogTitle>
            <DialogDescription>
              Créez un code gérant pour protéger l'ajout et la modification du stock.
              Ce code n’est pas votre mot de passe de compte. Il est optionnel, destiné aux comptes partagés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {profile?.managerPinHash && (
              <>
                <Label htmlFor="cur-code">Code actuel</Label>
                <Input id="cur-code" type="password" value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} />
              </>
            )}
            <Label htmlFor="new-code">Nouveau code</Label>
            <Input id="new-code" type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <Label htmlFor="conf-code">Confirmer le code</Label>
            <Input id="conf-code" type="password" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsSecurityDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveSecurityCode} disabled={isSavingCode} className="bg-gradient-primary text-white">
              {isSavingCode ? 'Enregistrement…' : 'Enregistrer le code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockPage;
