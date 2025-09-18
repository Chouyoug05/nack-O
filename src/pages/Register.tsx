import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Building2 } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    establishmentName: "",
    establishmentType: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    logoUrl: "",
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUpWithEmail, saveProfile } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const establishmentTypes = [
    { value: "bar", label: "Bar" },
    { value: "snack", label: "Snack Bar" },
    { value: "nightclub", label: "Boîte de nuit" },
    { value: "restaurant-bar", label: "Restaurant-Bar" },
    { value: "hotel-bar", label: "Bar d'hôtel" },
    { value: "other", label: "Autre" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signUpWithEmail(formData.email, formData.password);
      let finalLogoUrl = formData.logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadImageToCloudinary(logoFile, "logos");
      }
      await saveProfile({
        establishmentName: formData.establishmentName,
        establishmentType: formData.establishmentType,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        logoUrl: finalLogoUrl || undefined,
      });
      toast({ title: "Inscription réussie !", description: "Bienvenue sur NACK!" });
      navigate("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Réessayez.";
      toast({ title: "Inscription échouée", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <NackLogo size="md" className="mb-2" />
          <p className="text-muted-foreground text-sm">Rejoignez la communauté NACK!</p>
        </div>

        {/* Register Card */}
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Créer un compte</CardTitle>
            <CardDescription>
              Configurez votre établissement
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="establishmentName">Nom de l'établissement</Label>
                <Input
                  id="establishmentName"
                  name="establishmentName"
                  placeholder="Mon Bar"
                  value={formData.establishmentName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="establishmentType">Type d'établissement</Label>
                <Select
                  value={formData.establishmentType}
                  onValueChange={(value) => setFormData({...formData, establishmentType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {establishmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName">Nom du gérant</Label>
                <Input
                  id="ownerName"
                  name="ownerName"
                  placeholder="Votre nom"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+241 XX XX XX XX"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo (URL, optionnel)</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  placeholder="https://.../logo.png"
                  value={formData.logoUrl}
                  onChange={handleInputChange}
                />
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="nack"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Création du compte..." : "Créer mon compte"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link 
                  to="/login" 
                  className="text-nack-red hover:text-nack-red-dark font-medium"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Type Hint */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-white/50 px-3 py-2 rounded-full">
            <Building2 size={14} />
            <span>Pour tous types d'établissements au Gabon</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;