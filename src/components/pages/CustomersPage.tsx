import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { customersColRef, loyaltyConfigDocRef } from "@/lib/collections";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Heart, 
  Star, 
  Crown, 
  Phone, 
  Mail, 
  Calendar,
  TrendingUp,
  Gift,
  User,
  X
} from "lucide-react";
import { 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  where,
  getDocs
} from "firebase/firestore";
import type { Customer, CustomerDoc, LoyaltyType, CustomerStatus, Reward } from "@/types/customer";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

const CustomersPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    loyaltyType: "points" as LoyaltyType,
    notes: "",
    allergies: "",
    preferences: "",
  });

  // Générer un ID client unique
  const generateCustomerId = () => {
    return `CLI-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  // Charger les clients
  useEffect(() => {
    if (!user) return;
    const q = query(customersColRef(db, user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Customer[] = snap.docs.map((d) => {
        const data = d.data() as CustomerDoc;
        return {
          id: d.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          photoUrl: data.photoUrl,
          customerId: data.customerId,
          loyaltyType: data.loyaltyType,
          status: data.status,
          points: data.points || 0,
          totalPointsEarned: data.totalPointsEarned || 0,
          totalAmountSpent: data.totalAmountSpent || 0,
          totalOrders: data.totalOrders || 0,
          lastVisit: data.lastVisit ? new Date(data.lastVisit) : undefined,
          availableRewards: data.availableRewards || [],
          notes: data.notes,
          allergies: data.allergies,
          preferences: data.preferences,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        };
      });
      setCustomers(list);
    });
    return () => unsub();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustomer = async () => {
    if (!user) return;
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    // Vérifier si le numéro existe déjà
    const existingQuery = query(
      customersColRef(db, user.uid),
      where("phone", "==", formData.phone)
    );
    const existing = await getDocs(existingQuery);
    if (!existing.empty && !isEditing) {
      toast({
        title: "Erreur",
        description: "Un client avec ce numéro existe déjà",
        variant: "destructive"
      });
      return;
    }

    let photoUrl = formData.email ? undefined : undefined;
    try {
      if (selectedImage) {
        photoUrl = await uploadImageToCloudinary(selectedImage, "customers");
      }
    } catch (e) {
      console.error("Erreur upload image:", e);
    }

    const customerData: Partial<CustomerDoc> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email || undefined,
      photoUrl: photoUrl || undefined,
      customerId: isEditing && selectedCustomer ? selectedCustomer.customerId : generateCustomerId(),
      loyaltyType: formData.loyaltyType,
      status: "classic" as CustomerStatus,
      points: 0,
      totalPointsEarned: 0,
      totalAmountSpent: 0,
      totalOrders: 0,
      availableRewards: [],
      rewardHistory: [],
      notes: formData.notes || undefined,
      allergies: formData.allergies ? formData.allergies.split(",").map(a => a.trim()) : undefined,
      preferences: formData.preferences ? formData.preferences.split(",").map(p => p.trim()) : undefined,
      pointsConfig: formData.loyaltyType === "points" ? {
        pointsPer1000XAF: 10,
        bonusThreshold: 100,
        autoReset: true,
      } : undefined,
      updatedAt: Date.now(),
    };

    if (isEditing && selectedCustomer) {
      await updateDoc(doc(customersColRef(db, user.uid), selectedCustomer.id), {
        ...customerData,
        points: selectedCustomer.points,
        totalPointsEarned: selectedCustomer.totalPointsEarned,
        totalAmountSpent: selectedCustomer.totalAmountSpent,
        totalOrders: selectedCustomer.totalOrders,
        availableRewards: selectedCustomer.availableRewards,
      });
      toast({ title: "Client modifié", description: "Les informations ont été mises à jour" });
    } else {
      await addDoc(customersColRef(db, user.uid), {
        ...customerData,
        createdAt: Date.now(),
      });
      toast({ title: "Client ajouté", description: "Le client a été enregistré avec succès" });
    }

    // Réinitialiser le formulaire
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      loyaltyType: "points",
      notes: "",
      allergies: "",
      preferences: "",
    });
    setSelectedImage(null);
    setImagePreview(null);
    setIsAddModalOpen(false);
    setIsEditing(false);
    setSelectedCustomer(null);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!user) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) return;
    
    try {
      await deleteDoc(doc(customersColRef(db, user.uid), customerId));
      toast({ title: "Client supprimé", description: "Le client a été supprimé avec succès" });
    } catch (e) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le client",
        variant: "destructive"
      });
    }
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email || "",
      loyaltyType: customer.loyaltyType,
      notes: customer.notes || "",
      allergies: customer.allergies?.join(", ") || "",
      preferences: customer.preferences?.join(", ") || "",
    });
    setImagePreview(customer.photoUrl || null);
    setIsEditing(true);
    setIsAddModalOpen(true);
  };

  const openViewModal = (customer: Customer) => {
    navigate(`/customer/${customer.id}`);
  };

  const getStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "vip":
        return <Badge className="bg-yellow-500 text-white"><Crown className="w-3 h-3 mr-1" />VIP</Badge>;
      case "fidel":
        return <Badge className="bg-blue-500 text-white"><Star className="w-3 h-3 mr-1" />Fidèle</Badge>;
      default:
        return <Badge variant="outline">Classique</Badge>;
    }
  };

  const getLoyaltyTypeLabel = (type: LoyaltyType) => {
    switch (type) {
      case "points":
        return "Carte à points";
      case "amount":
        return "Montant cumulé";
      case "vip":
        return "VIP";
      default:
        return type;
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase();
    return (
      customer.firstName.toLowerCase().includes(query) ||
      customer.lastName.toLowerCase().includes(query) ||
      customer.phone.includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.customerId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#f6f8f6]">
      <main className="flex-grow p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Clients Favoris</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez vos clients réguliers et leur fidélité
            </p>
          </div>
          <Button
            onClick={() => {
              setIsEditing(false);
              setSelectedCustomer(null);
              setFormData({
                firstName: "",
                lastName: "",
                phone: "",
                email: "",
                loyaltyType: "points",
                notes: "",
                allergies: "",
                preferences: "",
              });
              setImagePreview(null);
              setSelectedImage(null);
              setIsAddModalOpen(true);
            }}
            className="bg-gradient-primary text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un client
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Rechercher par nom, téléphone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total clients</p>
                  <p className="text-2xl font-bold">{customers.length}</p>
                </div>
                <User className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clients VIP</p>
                  <p className="text-2xl font-bold">
                    {customers.filter(c => c.status === "vip").length}
                  </p>
                </div>
                <Crown className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Points totaux</p>
                  <p className="text-2xl font-bold">
                    {customers.reduce((sum, c) => sum + c.points, 0)}
                  </p>
                </div>
                <Star className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openViewModal(customer)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={customer.photoUrl} />
                    <AvatarFallback>
                      {customer.firstName[0]}{customer.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {customer.firstName} {customer.lastName}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{customer.customerId}</p>
                      </div>
                      {getStatusBadge(customer.status)}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      {customer.loyaltyType === "points" && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="font-medium">{customer.points} pts</span>
                        </div>
                      )}
                      {customer.loyaltyType === "amount" && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="font-medium">{customer.totalAmountSpent.toLocaleString()} XAF</span>
                        </div>
                      )}
                      {customer.totalOrders > 0 && (
                        <span className="text-muted-foreground">
                          {customer.totalOrders} commande{customer.totalOrders > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(customer);
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomer(customer.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun client</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Aucun résultat pour votre recherche" : "Commencez par ajouter votre premier client"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsAddModalOpen(true)} className="bg-gradient-primary text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un client
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add/Edit Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier le client" : "Ajouter un client favori"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Modifiez les informations du client" : "Enregistrez un nouveau client régulier"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Photo */}
            <div className="space-y-2">
              <Label>Photo (optionnel)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-secondary file:text-nack-red"
              />
              {imagePreview && (
                <div className="relative w-24 h-24">
                  <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedImage(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Nom"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+241 6XX XX XX XX"
                  type="tel"
                />
              </div>
              <div className="space-y-2">
                <Label>Email (optionnel)</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemple.com"
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Type de fidélité</Label>
              <select
                value={formData.loyaltyType}
                onChange={(e) => setFormData({ ...formData, loyaltyType: e.target.value as LoyaltyType })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="points">Carte à points</option>
                <option value="amount">Montant cumulé</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Notes internes (optionnel)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Allergies, préférences, etc."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allergies (séparées par des virgules)</Label>
                <Input
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="Arachides, Gluten, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Préférences (séparées par des virgules)</Label>
                <Input
                  value={formData.preferences}
                  onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                  placeholder="Cocktail préféré, Table préférée, etc."
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddCustomer} className="bg-gradient-primary text-white">
              {isEditing ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CustomersPage;

