import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Smartphone, Loader2, Users, Shield, Clock } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signInWithEmail, signInWithGoogle, user, profile, profileLoading, isAdmin, isAdminLoading } = useAuth();

  useEffect(() => {
    if (user && !profileLoading && !isAdminLoading) {
      if (isAdmin) navigate('/admin', { replace: true });
      else if (profile) navigate('/dashboard', { replace: true });
      else navigate('/complete-profile', { replace: true });
    }
  }, [user, profile, profileLoading, isAdmin, isAdminLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmail(formData.email, formData.password);
      toast({ title: "Connexion réussie !", description: "Bienvenue sur NACK!" });
      // La redirection est gérée par l'effet en fonction de isAdmin/profile
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Vérifiez vos identifiants.";
      toast({ title: "Erreur de connexion", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    // Forcer le domaine canonique (www -> apex) avant de démarrer l’OAuth
    try {
      if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host.toLowerCase().startsWith('www.')) {
          const target = window.location.href.replace(/^https?:\/\/www\./i, (m) => m.replace('www.', ''));
          window.location.replace(target);
          return;
        }
      }
    } catch {
      // ignore
    }

    setIsLoading(true);
    try {
      await signInWithGoogle();
      // Redirection lancée — le flux continuera au retour
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Réessayez.";
      toast({ title: "Connexion Google échouée", description: message, variant: "destructive" });
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
          <NackLogo size="lg" className="mb-3" />
          <p className="text-muted-foreground text-sm">Plateforme de gestion gabonaise</p>
        </div>

        {/* Message d'accueil pour l'équipe */}
        <div className="mb-6 p-4 bg-gradient-to-r from-nack-red/10 to-nack-red/5 rounded-xl border border-nack-red/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Users className="text-nack-red" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">
                Connexion équipe
              </p>
              <p className="text-xs text-muted-foreground">
                Gérants, serveurs, agents d'événements : connectez-vous pour accéder à vos outils de travail
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Se connecter</CardTitle>
            <CardDescription className="text-base">
              Accédez à votre espace de gestion
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="h-12"
                />
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
                    className="h-12 pr-10"
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

              <div className="flex items-center justify-between text-sm">
                <Link 
                  to="/forgot-password" 
                  className="text-nack-red hover:text-nack-red-dark"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <Button
                type="submit"
                variant="nack"
                size="lg"
                className="w-full h-12"
                disabled={isLoading}
              >
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>

            {/* Bouton Google temporairement désactivé */}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Pas encore de compte ?{" "}
                <Link 
                  to="/register" 
                  className="text-nack-red hover:text-nack-red-dark font-medium transition-colors"
                >
                  S'inscrire
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Informations pour l'équipe */}
        <div className="mt-6 grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-gray-200/50">
            <div className="flex-shrink-0 w-10 h-10 bg-nack-red/10 rounded-full flex items-center justify-center">
              <Shield className="text-nack-red" size={18} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Sécurisé</p>
              <p className="text-xs text-muted-foreground">Vos données sont protégées</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-gray-200/50">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Users className="text-blue-600" size={18} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Accès équipe</p>
              <p className="text-xs text-muted-foreground">Gérez avec votre équipe</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-gray-200/50">
            <div className="flex-shrink-0 w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <Clock className="text-green-600" size={18} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Disponible 24/7</p>
              <p className="text-xs text-muted-foreground">Accès à tout moment</p>
            </div>
          </div>
        </div>

        {/* Mobile App Hint */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200/50">
            <Smartphone size={16} />
            <span>Optimisé pour mobile et tablette</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;