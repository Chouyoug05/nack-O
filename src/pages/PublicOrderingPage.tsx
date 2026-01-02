import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, onSnapshot, query, orderBy, QuerySnapshot, DocumentData, updateDoc, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingBag, MapPin, CheckCircle, Package, Printer, Download, Grid3x3, Search, CreditCard, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCodeLib from "qrcode";
import { generateTicketPDF } from "@/utils/ticketPDF";
import { printThermalTicket } from "@/utils/ticketThermal";
import { MenuThemeConfig, defaultMenuTheme } from "@/types/menuTheme";
import { createMenuDigitalPaymentLink } from "@/lib/payments/menuDigitalPayment";
import { paymentsColRef, barOrdersColRef } from "@/lib/collections";

interface Product {
  id: string;
  name: string;
  price: number | string;
  imageUrl?: string;
  category?: string;
  available?: boolean;
  quantity?: number;
  stock?: number;
  rating?: number;
  ratingCount?: number;
  description?: string;
}

interface TableZone {
  id: string;
  name: string;
  type: 'table' | 'zone';
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Establishment {
  establishmentName: string;
  logoUrl?: string;
  companyName?: string;
  fullAddress?: string;
  businessPhone?: string;
  rcsNumber?: string;
  nifNumber?: string;
  legalMentions?: string;
  customMessage?: string;
  ticketLogoUrl?: string;
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
  disbursementId?: string; // Disbursement ID pour recevoir les paiements
  disbursementStatus?: 'pending' | 'approved' | 'rejected'; // Statut du Disbursement ID
  airtelMoneyNumber?: string; // Numéro Airtel Money
  deliveryEnabled?: boolean; // Livraison activée
  deliveryPrice?: number; // Prix de livraison en XAF
}

const PublicOrderingPage = () => {
  // Hooks de routing
  const params = useParams<{ establishmentId: string }>();
  const location = useLocation();
  const establishmentId = useMemo(() => params?.establishmentId ?? null, [params?.establishmentId]);
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableZone[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [receiptQR, setReceiptQR] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuTheme, setMenuTheme] = useState<MenuThemeConfig>(defaultMenuTheme);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAirtelNumberDialog, setShowAirtelNumberDialog] = useState(false);
  const [airtelNumberInput, setAirtelNumberInput] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  // Livraison
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // useRef
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeProductsRef = useRef<(() => void) | null>(null);
  const unsubscribeTablesRef = useRef<(() => void) | null>(null);

  // Calcul du total de la commande (articles du panier + livraison si applicable)
  // Ce total est utilisé pour le paiement Menu Digital, PAS le prix de l'abonnement
  const total = useMemo(() => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0;
    return itemsTotal + deliveryFee;
  }, [cart, isDelivery, establishment]);

  // Vérifier si on revient d'un paiement réussi
  useEffect(() => {
    if (location.state && (location.state as any).paymentSuccess) {
      setShowPaymentSuccess(true);
      setCart([]); // Vider le panier après paiement réussi
      // Masquer le message après 5 secondes
      setTimeout(() => setShowPaymentSuccess(false), 5000);
    }
  }, [location.state]);

  // Charger le thème du menu
  useEffect(() => {
    if (!establishmentId) return;

    const loadTheme = async () => {
      try {
        const themeDoc = await getDoc(doc(db, `profiles/${establishmentId}/menuDigital`, 'theme'));
        if (themeDoc.exists()) {
          setMenuTheme({ ...defaultMenuTheme, ...themeDoc.data() } as MenuThemeConfig);
        }
      } catch (error) {
        console.error('Erreur chargement thème:', error);
      }
    };

    loadTheme();
  }, [establishmentId]);

  // useEffect principal
  useEffect(() => {
    isMountedRef.current = true;
    
    if (unsubscribeProductsRef.current) {
      try {
        unsubscribeProductsRef.current();
      } catch (e) {}
      unsubscribeProductsRef.current = null;
    }
    if (unsubscribeTablesRef.current) {
      try {
        unsubscribeTablesRef.current();
      } catch (e) {}
      unsubscribeTablesRef.current = null;
    }

    const cleanup = () => {
      isMountedRef.current = false;
      if (unsubscribeProductsRef.current) {
        try {
          unsubscribeProductsRef.current();
        } catch (e) {}
        unsubscribeProductsRef.current = null;
      }
      if (unsubscribeTablesRef.current) {
        try {
          unsubscribeTablesRef.current();
        } catch (e) {}
        unsubscribeTablesRef.current = null;
      }
    };

    if (!establishmentId) {
      setIsLoading(false);
      return cleanup;
    }

    // Charger l'établissement
    getDoc(doc(db, 'profiles', establishmentId))
      .then((profileDoc) => {
        if (!isMountedRef.current) return;
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setEstablishment({
            establishmentName: profileData.establishmentName || 'Établissement',
            logoUrl: profileData.logoUrl,
            companyName: profileData.companyName,
            fullAddress: profileData.fullAddress,
            businessPhone: profileData.businessPhone,
            rcsNumber: profileData.rcsNumber,
            nifNumber: profileData.nifNumber,
            legalMentions: profileData.legalMentions,
            customMessage: profileData.customMessage,
            ticketLogoUrl: profileData.ticketLogoUrl,
            showDeliveryMention: profileData.showDeliveryMention,
            showCSSMention: profileData.showCSSMention,
            cssPercentage: profileData.cssPercentage,
            ticketFooterMessage: profileData.ticketFooterMessage,
            disbursementId: profileData.disbursementId,
            disbursementStatus: profileData.disbursementStatus,
            airtelMoneyNumber: profileData.airtelMoneyNumber,
            deliveryEnabled: profileData.deliveryEnabled,
            deliveryPrice: profileData.deliveryPrice,
          });
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setIsLoading(false);
      });

    // Charger les produits
    const productsRef = collection(db, `profiles/${establishmentId}/products`);
    
    const handleProductsSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      if (!isMountedRef.current) return;
      
      const productsData = snapshot.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          name: data.name || '',
          price: data.price || 0,
          category: data.category || '',
          available: data.available !== false,
          quantity: data.quantity || data.stock || 0,
          stock: data.quantity || data.stock || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          description: data.description || '',
          imageUrl: (data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.trim() !== '') 
            ? data.imageUrl.trim() 
            : undefined,
        } as Product;
      });
      
      const availableProducts = productsData.filter(p => {
        const priceValue = typeof p.price === 'number' 
          ? p.price 
          : parseFloat(String(p.price || '0')) || 0;
        return priceValue > 0 && p.available !== false;
      });
      
      availableProducts.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setProducts(availableProducts);
      setIsLoading(false);
    };
    
    let unsubscribeProducts: (() => void) | null = null;
    
    try {
      const productsQuery = query(productsRef, orderBy('name'));
      unsubscribeProducts = onSnapshot(
        productsQuery,
        handleProductsSnapshot,
        (error) => {
          // Erreur avec orderBy, charger sans tri
          if (unsubscribeProducts) {
            unsubscribeProducts();
            unsubscribeProducts = null;
          }
          const simpleQuery = query(productsRef);
          unsubscribeProducts = onSnapshot(
            simpleQuery,
            handleProductsSnapshot,
            (err) => {
              if (!isMountedRef.current) return;
              console.error('❌ Erreur produits:', err);
              setIsLoading(false);
            }
          );
          unsubscribeProductsRef.current = unsubscribeProducts;
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    } catch (error) {
      // Erreur création query, charger directement
      unsubscribeProducts = onSnapshot(
        productsRef,
        handleProductsSnapshot,
        (err) => {
          if (!isMountedRef.current) return;
          console.error('❌ Erreur produits:', err);
          setIsLoading(false);
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    }

    // Charger les tables
    const tablesRef = collection(db, `profiles/${establishmentId}/tables`);
    const unsubscribeTables = onSnapshot(
      tablesRef,
      (snapshot) => {
        if (!isMountedRef.current) return;
        const tablesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TableZone[];
        
        const filteredTables = tablesData.filter(t => !('deleted' in t && t.deleted));
        setTables(filteredTables);
        setIsLoading(false);
      },
      (error) => {
        if (!isMountedRef.current) return;
        console.error('Erreur tables:', error);
        setIsLoading(false);
      }
    );
    unsubscribeTablesRef.current = unsubscribeTables;

    return cleanup;
  }, [establishmentId]);

  // Fonctions
  const addToCart = (product: Product) => {
    const priceValue = typeof product.price === 'number' 
      ? product.price 
      : parseFloat(String(product.price)) || 0;
    
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          name: product.name,
          price: priceValue,
          quantity: 1
        }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        return prev.filter(item => item.productId !== productId);
      }
    });
  };

  const availableCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategoryTab === "all" || product.category === activeCategoryTab;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategoryTab]);

  const requestAirtelNumber = async () => {
    if (!establishmentId || !airtelNumberInput.trim()) {
      alert('Veuillez entrer un numéro Airtel Money valide.');
      return;
    }

    // Note: La création de demande de Disbursement ID doit être faite depuis l'interface d'administration
    // (BarConnecteePage) car elle nécessite une authentification. Ici, on informe simplement le client.
    setShowAirtelNumberDialog(false);
    setAirtelNumberInput("");
    alert('Le paiement en ligne n\'est pas encore disponible pour cet établissement. L\'établissement doit configurer son Disbursement ID depuis son interface d\'administration. Vous pouvez commander sans paiement pour l\'instant.');
  };

  const placeOrder = async (withPayment: boolean = false) => {
    if (!establishmentId || cart.length === 0) {
      alert('Votre panier est vide.');
      return;
    }
    
    // Validation : table ou livraison
    if (!isDelivery && !selectedTable) {
      alert('Veuillez sélectionner une table ou activer la livraison.');
      return;
    }
    
    if (isDelivery && !deliveryAddress.trim()) {
      alert('Veuillez saisir votre adresse de livraison.');
      return;
    }

    // Si paiement demandé mais pas de Disbursement ID configuré
    if (withPayment && (!establishment?.disbursementId || establishment.disbursementStatus !== 'approved')) {
      if (!establishment?.airtelMoneyNumber) {
        // Demander le numéro Airtel Money
        setShowAirtelNumberDialog(true);
        return;
      } else {
        alert('Votre Disbursement ID est en attente de validation par l\'administration. Vous pouvez commander sans paiement pour l\'instant.');
        return;
      }
    }

    try {
      const orderNumberValue = `CMD${Date.now().toString().slice(-6)}`;
      const receiptNumber = `RCP${Date.now().toString().slice(-6)}`;

      // Si paiement demandé et Disbursement ID configuré
      if (withPayment && establishment?.disbursementId && establishment.disbursementStatus === 'approved') {
        setIsProcessingPayment(true);
        try {
          const transactionId = `TXN-MENU-${establishmentId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const base = (import.meta.env.VITE_PUBLIC_BASE_URL as string || window.location.origin).replace(/\/+$/, '');
          const reference = `menu-digital-${orderNumberValue}`;
          const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}&establishmentId=${establishmentId}`;
          const redirectError = `${base}/payment/error?reference=${reference}&transactionId=${transactionId}&establishmentId=${establishmentId}`;
          // Utiliser le logo de l'établissement, ou un logo par défaut
          const logoURL = establishment?.logoUrl || `${base}/favicon.png`;

          // Préparer les données de commande à stocker dans la transaction
          // La commande sera créée seulement après paiement réussi
          const orderData: any = {
            orderNumber: orderNumberValue,
            receiptNumber,
            tableZone: isDelivery ? 'Livraison' : selectedTable,
            items: cart,
            total,
            status: 'pending',
            createdAt: Date.now(),
            isDelivery: isDelivery || false,
            deliveryPrice: (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0,
            customerInfo: {
              userAgent: navigator.userAgent,
              timestamp: Date.now()
            }
          };
          
          // Ajouter deliveryAddress seulement si c'est une livraison (éviter undefined)
          if (isDelivery && deliveryAddress) {
            orderData.deliveryAddress = deliveryAddress;
          }

          // Enregistrer la transaction de paiement avec les données de commande
          // IMPORTANT: Le montant 'total' correspond au total de la commande (articles du panier),
          // PAS au prix de l'abonnement mensuel. C'est calculé comme: sum(item.price * item.quantity)
          // La commande sera créée seulement après paiement réussi dans PaymentSuccess.tsx
          await addDoc(paymentsColRef(db, establishmentId), {
            userId: establishmentId,
            transactionId,
            subscriptionType: 'menu-digital',
            amount: total, // Montant de la commande (articles), pas l'abonnement
            status: 'pending',
            paymentMethod: 'airtel-money',
            reference,
            paymentLink: '',
            redirectSuccess,
            redirectError,
            establishmentId,
            disbursementId: establishment.disbursementId,
            // Stocker les données de commande dans la transaction pour création après paiement
            orderData: orderData,
            createdAt: Date.now(),
          });

          // Créer le lien de paiement
          // Le montant 'total' est le total de la commande (articles), calculé depuis le panier
          const paymentLink = await createMenuDigitalPaymentLink({
            amount: total, // Total des articles commandés, pas le prix de l'abonnement
            reference,
            redirectSuccess,
            redirectError,
            logoURL,
            disbursementId: establishment.disbursementId,
          });

          // Mettre à jour la transaction avec le lien
          const paymentsRef = paymentsColRef(db, establishmentId);
          const paymentsQuery = query(paymentsRef, orderBy('createdAt', 'desc'));
          const paymentsSnapshot = await getDocs(paymentsQuery);
          if (!paymentsSnapshot.empty) {
            const latestPayment = paymentsSnapshot.docs[0];
            await updateDoc(doc(db, `profiles/${establishmentId}/payments`, latestPayment.id), {
              paymentLink,
            });
          }

          // Rediriger vers le paiement
          window.location.href = paymentLink;
          return;
        } catch (error) {
          console.error('Erreur création paiement:', error);
          alert('Erreur lors de la création du lien de paiement. Veuillez réessayer.');
        } finally {
          setIsProcessingPayment(false);
        }
      }

      // Si pas de paiement, créer la commande immédiatement dans barOrders
      // IMPORTANT: Les commandes sur place doivent arriver dans les commandes clients
      const orderData: any = {
        orderNumber: orderNumberValue,
        receiptNumber,
        tableZone: isDelivery ? 'Livraison' : selectedTable,
        items: cart,
        total,
        status: 'pending', // Statut pending pour apparaître dans les commandes clients
        createdAt: Date.now(),
        isDelivery: isDelivery || false,
        deliveryPrice: (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0,
        customerInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };
      
      // Ajouter deliveryAddress seulement si c'est une livraison (éviter undefined)
      if (isDelivery && deliveryAddress) {
        orderData.deliveryAddress = deliveryAddress;
      }

      // Créer la commande dans barOrders pour qu'elle arrive chez le gérant
      if (establishmentId) {
        await addDoc(barOrdersColRef(db, establishmentId), orderData);
      }

      const receiptData = {
        orderNumber: orderNumberValue,
        receiptNumber,
        establishmentId,
        total,
        items: cart,
        tableZone: selectedTable,
        createdAt: Date.now()
      };

      const receiptQRDataUrl = await QRCodeLib.toDataURL(JSON.stringify(receiptData), {
        width: 200,
        margin: 2
      });

      setOrderNumber(orderNumberValue);
      setReceiptQR(receiptQRDataUrl);
      setOrderComplete(true);

    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      alert('Erreur lors de la commande. Veuillez réessayer.');
    }
  };

  const downloadReceipt = async () => {
    if (!establishment || !orderNumber) return;

    try {
      const ticketData = {
        orderNumber,
        establishmentName: establishment.establishmentName,
        establishmentLogo: establishment.logoUrl,
        tableZone: selectedTable,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total,
        createdAt: Date.now(),
        receiptData: {
          orderId: orderNumber,
          establishmentId: establishmentId || '',
          timestamp: Date.now()
        },
        companyName: establishment.companyName,
        fullAddress: establishment.fullAddress,
        businessPhone: establishment.businessPhone,
        rcsNumber: establishment.rcsNumber,
        nifNumber: establishment.nifNumber,
        legalMentions: establishment.legalMentions,
        customMessage: establishment.customMessage,
        ticketLogoUrl: establishment.ticketLogoUrl,
        showDeliveryMention: establishment.showDeliveryMention,
        showCSSMention: establishment.showCSSMention,
        cssPercentage: establishment.cssPercentage,
        ticketFooterMessage: establishment.ticketFooterMessage,
      };

      await generateTicketPDF(ticketData);
    } catch (error) {
      console.error('Erreur génération ticket PDF:', error);
    }
  };

  const printReceipt = () => {
    if (!establishment || !orderNumber) return;

    try {
      const thermalData = {
        orderNumber,
        establishmentName: establishment.establishmentName,
        establishmentLogo: establishment.logoUrl,
        tableZone: selectedTable,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total,
        createdAt: Date.now(),
        companyName: establishment.companyName,
        fullAddress: establishment.fullAddress,
        businessPhone: establishment.businessPhone,
        rcsNumber: establishment.rcsNumber,
        nifNumber: establishment.nifNumber,
        legalMentions: establishment.legalMentions,
        customMessage: establishment.customMessage,
        ticketLogoUrl: establishment.ticketLogoUrl,
        showDeliveryMention: establishment.showDeliveryMention,
        showCSSMention: establishment.showCSSMention,
        cssPercentage: establishment.cssPercentage,
        ticketFooterMessage: establishment.ticketFooterMessage
      };

      printThermalTicket(thermalData);
    } catch (error) {
      console.error('Erreur impression ticket:', error);
      alert('Erreur lors de l\'impression. Veuillez réessayer.');
    }
  };

  // Styles dynamiques basés sur le thème
  const getCardStyle = () => {
    const baseStyle = "bg-white transition-all duration-200 hover:scale-[1.02]";
    const borderRadius = {
      small: "rounded-md",
      medium: "rounded-lg",
      large: "rounded-xl"
    }[menuTheme.borderRadius];

    switch (menuTheme.cardStyle) {
      case 'minimalist':
        return `${baseStyle} ${borderRadius} border border-gray-200`;
      case 'shadow':
        return `${baseStyle} ${borderRadius} shadow-md hover:shadow-lg`;
      case 'border':
        return `${baseStyle} ${borderRadius} border-2 border-gray-300`;
      default:
        return `${baseStyle} ${borderRadius} shadow-md`;
    }
  };

  const getBackgroundStyle = () => {
    if (menuTheme.backgroundType === 'image' && menuTheme.backgroundColor.startsWith('http')) {
      return {
        backgroundImage: `url(${menuTheme.backgroundColor})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    }
    // Fond texturé façon papier avec pattern CSS
    return {
      backgroundColor: menuTheme.backgroundColor,
      backgroundImage: `
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.03) 2px, rgba(0,0,0,.03) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,.03) 2px, rgba(0,0,0,.03) 4px)
      `,
      backgroundSize: '100% 100%'
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={getBackgroundStyle()}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: menuTheme.primaryColor }}></div>
          <p className="text-gray-700" style={{ color: menuTheme.primaryColor }}>Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ backgroundColor: menuTheme.primaryColor }}>
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold" style={{ color: menuTheme.primaryColor }}>Commande validée !</h2>
            <p className="text-gray-600">
              Merci pour votre commande. Elle est en cours de préparation.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl w-full">
            <img src={receiptQR} alt="QR Code reçu" className="w-32 h-32 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Montrez ce QR Code au serveur
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button onClick={printReceipt} className="w-full text-white" style={{ backgroundColor: menuTheme.primaryColor }}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
            <Button onClick={downloadReceipt} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </Button>
          </div>
          <Button 
            variant="outline"
            onClick={() => {
              setOrderComplete(false);
              setCart([]);
              setSelectedTable("");
            }}
            className="w-full"
          >
            Nouvelle commande
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={getBackgroundStyle()}>
      {/* Message de succès après paiement */}
      {showPaymentSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 shadow-lg flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Paiement réussi !</p>
              <p className="text-sm text-green-700">Votre commande a été payée avec succès.</p>
            </div>
            <button
              onClick={() => setShowPaymentSuccess(false)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Header avec logo */}
      <header className="sticky top-0 z-10 bg-white/98 backdrop-blur-sm shadow-md border-b-2" style={{ borderColor: menuTheme.primaryColor + '40' }}>
        <div className="container mx-auto px-4 py-3 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            {establishment?.logoUrl && (
              <img 
                src={establishment.logoUrl} 
                alt={establishment.establishmentName} 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover border-2 shadow-sm flex-shrink-0"
                style={{ borderColor: menuTheme.primaryColor }}
              />
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-wide truncate" style={{ color: menuTheme.primaryColor, fontFamily: menuTheme.titleFont || 'Georgia, serif' }}>
              {establishment?.establishmentName || "Menu"}
            </h1>
          </div>
          <div className="relative cursor-pointer flex-shrink-0 ml-2">
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: menuTheme.primaryColor }} />
            {cart.length > 0 && (
              <span 
                className="absolute -top-2 -right-2 text-white text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold shadow-lg"
                style={{ backgroundColor: menuTheme.primaryColor }}
              >
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-32 sm:pb-24">
        {/* Filtres et recherche */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/90"
              />
            </div>
            <Select value={activeCategoryTab} onValueChange={setActiveCategoryTab}>
              <SelectTrigger className="w-full sm:w-[250px] bg-white/90">
                <SelectValue>
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
                {availableCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grille produits - 2 colonnes mobile, 3 colonnes tablette+ */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {filteredProducts.map((product) => {
            const priceValue = typeof product.price === 'number' 
              ? product.price 
              : parseFloat(String(product.price)) || 0;
            
            return (
              <div
                key={product.id}
                className={getCardStyle()}
                onClick={() => setSelectedProduct(product)}
                role="button"
                tabIndex={0}
              >
                {product.imageUrl ? (
                  <div className="w-full h-40 bg-gray-100 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('svg')) {
                          parent.className = 'w-full h-40 bg-gray-100 flex items-center justify-center';
                          parent.innerHTML = '<svg class="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-3 line-clamp-2 leading-tight" style={{ color: menuTheme.primaryColor, fontFamily: 'Georgia, serif' }}>
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: menuTheme.primaryColor + '20' }}>
                    <span className="text-xl font-bold tracking-wide" style={{ color: menuTheme.primaryColor }}>
                      {priceValue.toLocaleString('fr-FR')} XAF
                    </span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className="text-white shadow-md hover:shadow-lg transition-shadow"
                      style={{ backgroundColor: menuTheme.primaryColor }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchTerm || activeCategoryTab !== "all" 
                ? "Aucun produit ne correspond à votre recherche." 
                : "Aucun produit disponible pour le moment."}
            </p>
          </div>
        )}
      </main>

      {/* Panier fixe en bas */}
      {cart.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-2 sm:p-4 z-20">
          <div className="container mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-gray-600">Total</p>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: menuTheme.primaryColor }}>
                {total.toLocaleString('fr-FR')} XAF
              </p>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Button
                onClick={() => {
                  if ((!isDelivery && !selectedTable) || (isDelivery && !deliveryAddress.trim())) {
                    setShowTableDialog(true);
                  } else {
                    placeOrder(false);
                  }
                }}
                variant="outline"
                className="px-4 sm:px-6 text-sm sm:text-base flex-1 sm:flex-none"
                style={{ borderColor: menuTheme.primaryColor, color: menuTheme.primaryColor }}
              >
                Commander
              </Button>
              {establishment?.disbursementId && establishment.disbursementStatus === 'approved' && (
                <div className="flex flex-col items-stretch sm:items-end gap-1 flex-1 sm:flex-none">
                  <Button
                    onClick={() => {
                      if ((!isDelivery && !selectedTable) || (isDelivery && !deliveryAddress.trim())) {
                        setShowTableDialog(true);
                      } else {
                        placeOrder(true);
                      }
                    }}
                    disabled={isProcessingPayment}
                    className="px-4 sm:px-6 text-white text-sm sm:text-base w-full sm:w-auto"
                    style={{ backgroundColor: menuTheme.primaryColor }}
                  >
                    {isProcessingPayment ? 'Traitement...' : (
                      <>
                        <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Payer </span>
                        {total.toLocaleString('fr-FR')} XAF
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center sm:text-right">💳 Airtel Money uniquement</p>
                </div>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Panier flottant */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-24 right-2 sm:right-4 bg-white rounded-lg shadow-xl p-3 sm:p-4 max-w-xs max-h-64 overflow-y-auto z-10 border hidden sm:block" style={{ borderColor: menuTheme.primaryColor + '30' }}>
          <h3 className="font-bold mb-2" style={{ color: menuTheme.primaryColor }}>Panier</h3>
          <div className="max-h-40 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between mb-2 pb-2 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-gray-600">
                    {(item.price * item.quantity).toLocaleString('fr-FR')} XAF
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFromCart(item.productId)}
                    className="h-6 w-6 p-0"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const product = products.find(p => p.id === item.productId);
                      if (product) addToCart(product);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice && (
            <div className="mt-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Livraison:</span>
                <span className="font-medium">{establishment.deliveryPrice.toLocaleString('fr-FR')} XAF</span>
              </div>
            </div>
          )}
          <div className="mt-2 pt-2 border-t">
            <div className="flex justify-between font-bold">
              <span style={{ color: menuTheme.primaryColor }}>Total:</span>
              <span style={{ color: menuTheme.primaryColor }}>{total.toLocaleString('fr-FR')} XAF</span>
            </div>
          </div>
        </div>
      )}

      {/* Dialog sélection table ou livraison */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: menuTheme.primaryColor }}>
              <MapPin className="w-5 h-5" />
              Votre position
            </DialogTitle>
            <DialogDescription>
              Sélectionnez votre table, zone ou activez la livraison
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Option livraison */}
            {establishment?.deliveryEnabled && (
              <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="deliveryCheckbox"
                    checked={isDelivery}
                    onChange={(e) => {
                      setIsDelivery(e.target.checked);
                      if (e.target.checked) {
                        setSelectedTable("");
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="deliveryCheckbox" className="font-semibold cursor-pointer">
                    Livraison à domicile
                    {establishment.deliveryPrice && (
                      <span className="text-sm font-normal text-gray-600 ml-2">
                        (+{establishment.deliveryPrice.toLocaleString('fr-FR')} XAF)
                      </span>
                    )}
                  </Label>
                </div>
                {isDelivery && (
                  <div className="mt-2">
                    <Label htmlFor="deliveryAddress">Adresse de livraison *</Label>
                    <Input
                      id="deliveryAddress"
                      placeholder="Ex: Quartier Nzeng-Ayong, Rue 123..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Sélection table/zone (si livraison désactivée) */}
            {!isDelivery && (
              <>
                {tables.length === 0 ? (
                  <div className="space-y-2">
                    <Label>Table ou zone</Label>
                    <Input
                      placeholder="Ex: Table 3, Comptoir..."
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Table ou zone</Label>
                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Sélectionnez votre table/zone</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.name}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTableDialog(false);
                  setIsDelivery(false);
                  setDeliveryAddress("");
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <div className="flex gap-2 w-full">
                <Button
                  onClick={() => {
                    if ((isDelivery && deliveryAddress.trim()) || (!isDelivery && selectedTable)) {
                      setShowTableDialog(false);
                      placeOrder(false);
                    }
                  }}
                  disabled={(isDelivery && !deliveryAddress.trim()) || (!isDelivery && !selectedTable)}
                  variant="outline"
                  className="flex-1"
                  style={{ borderColor: menuTheme.primaryColor, color: menuTheme.primaryColor }}
                >
                  Commander
                </Button>
                {establishment?.disbursementId && establishment.disbursementStatus === 'approved' && (
                  <div className="flex-1 flex flex-col gap-1">
                    <Button
                      onClick={() => {
                        if ((isDelivery && deliveryAddress.trim()) || (!isDelivery && selectedTable)) {
                          setShowTableDialog(false);
                          placeOrder(true);
                        }
                      }}
                      disabled={(isDelivery && !deliveryAddress.trim()) || (!isDelivery && !selectedTable) || isProcessingPayment}
                      className="w-full text-white"
                      style={{ backgroundColor: menuTheme.primaryColor }}
                    >
                      {isProcessingPayment ? '...' : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Payer
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-gray-500">💳 Airtel Money uniquement</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup produit */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: menuTheme.primaryColor }}>{selectedProduct.name}</DialogTitle>
                <DialogDescription>
                  {selectedProduct.description || "Détails du produit"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedProduct.imageUrl && (
                  <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {selectedProduct.description && (
                  <p className="text-gray-600">{selectedProduct.description}</p>
                )}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-2xl font-bold" style={{ color: menuTheme.primaryColor }}>
                    {(typeof selectedProduct.price === 'number' 
                      ? selectedProduct.price 
                      : parseFloat(String(selectedProduct.price)) || 0
                    ).toLocaleString('fr-FR')} XAF
                  </span>
                  <Button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="text-white"
                    style={{ backgroundColor: menuTheme.primaryColor }}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Commander
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogue pour demander le numéro Airtel Money */}
      <Dialog open={showAirtelNumberDialog} onOpenChange={setShowAirtelNumberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recevoir les paiements sur Airtel Money</DialogTitle>
            <DialogDescription>
              Pour recevoir les paiements des commandes directement sur votre compte Airtel Money, 
              veuillez entrer votre numéro Airtel Money. Votre demande sera envoyée à l'administration 
              pour configuration du Disbursement ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="airtelNumber">Numéro Airtel Money</Label>
              <Input
                id="airtelNumber"
                type="tel"
                placeholder="Ex: 0612345678"
                value={airtelNumberInput}
                onChange={(e) => setAirtelNumberInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Format: 10 chiffres (ex: 0612345678)
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Une fois votre demande approuvée par l'administration, vous recevrez un message de confirmation 
                  et pourrez commencer à recevoir les paiements automatiquement.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAirtelNumberDialog(false);
              setAirtelNumberInput("");
            }}>
              Annuler
            </Button>
            <Button onClick={requestAirtelNumber} disabled={!airtelNumberInput.trim()}>
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicOrderingPage;
