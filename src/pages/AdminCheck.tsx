import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { adminDocRef } from "@/lib/collections";
import { setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Loader2, Shield, Plus, Users, Package, ShoppingCart, Calendar, Star, CreditCard, Bell, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NackLogo from "@/components/NackLogo";

const AdminCheck = () => {
  const { user, isAdmin, isAdminLoading, signInWithEmail, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  // Ne pas rediriger automatiquement, afficher le menu si admin
  // useEffect(() => {
  //   if (user && !isAdminLoading && isAdmin) {
  //     navigate('/admin', { replace: true });
  //   }
  // }, [user, isAdmin, isAdminLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await signInWithEmail(loginData.email, loginData.password);
      toast({ 
        title: "Connexion réussie !", 
        description: "Vérification de votre statut admin..." 
      });
      // La redirection sera gérée par l'effet ci-dessus
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Vérifiez vos identifiants.";
      toast({ 
        title: "Erreur de connexion", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
      toast({ 
        title: "Connexion réussie !", 
        description: "Vérification de votre statut admin..." 
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur lors de la connexion Google.";
      toast({ 
        title: "Erreur", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Afficher un loader pendant la vérification du statut admin
  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Vérification de votre accès...</p>
        </div>
      </div>
    );
  }

  // Si connecté et admin, afficher le tableau de bord admin
  if (user && isAdmin) {
    return (
      <div className="relative flex min-h-screen w-full flex-col bg-[#f6f8f6]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f6]/80 p-4 md:p-6 pb-2 backdrop-blur-sm border-b border-gray-200/50">
          <div className="w-8 md:w-12"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <NackLogo size="sm" />
            <span className="text-sm md:text-base lg:text-lg font-semibold text-gray-900">
              Administration Nack
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-xs md:text-sm"
            >
              Dashboard Gérant
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <section className="p-4 md:p-6 lg:p-8 pt-4 md:pt-6 lg:pt-8">
          <div className="w-full">
            <div className="grid grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
              <div className="flex flex-col items-center justify-center rounded-xl md:rounded-2xl border border-gray-200 bg-white p-3 md:p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm lg:text-base font-medium text-gray-500 mb-1 md:mb-2">Utilisateurs</p>
                <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">—</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl md:rounded-2xl border border-gray-200 bg-white p-3 md:p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm lg:text-base font-medium text-gray-500 mb-1 md:mb-2">Produits</p>
                <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">—</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl md:rounded-2xl border border-gray-200 bg-white p-3 md:p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs md:text-sm lg:text-base font-medium text-gray-500 mb-1 md:mb-2">Commandes</p>
                <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">—</p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Actions - Gros boutons */}
        <main className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4 lg:pt-6 flex-1">
          <div className="w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
              <button
                type="button"
                onClick={() => navigate('/admin?view=users')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Users size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-blue-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Utilisateurs
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=products')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Package size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-purple-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Produits
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=orders')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <ShoppingCart size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-green-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Commandes
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=events')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Calendar size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-orange-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Événements
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=ratings')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Star size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-yellow-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Appréciations
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=subscriptions')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <CreditCard size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-indigo-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Abonnements
                  </h2>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin?view=notifications')}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 rounded-xl md:rounded-2xl border border-gray-200 bg-white p-4 md:p-6 lg:p-8 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Bell size={40} className="md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-red-600 transition-transform group-hover:scale-110" />
                <div className="flex flex-col text-center">
                  <h2 className="text-base md:text-lg lg:text-xl font-semibold tracking-tight text-gray-900">
                    Notifications
                  </h2>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si connecté mais pas admin, afficher un message
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Accès administrateur requis</CardTitle>
            <CardDescription>
              Vous êtes connecté mais vous n'avez pas les droits administrateur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Aller au Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => {
                window.location.href = '/admin-check';
              }}
            >
              Se déconnecter et réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <NackLogo size="lg" className="mb-3" />
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <p className="text-muted-foreground text-sm font-semibold">Connexion Administrateur</p>
                </div>
          <p className="text-muted-foreground text-xs">Accès réservé aux administrateurs</p>
            </div>

        {/* Login Card */}
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Se connecter</CardTitle>
            <CardDescription className="text-base">
              Connectez-vous avec votre compte administrateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                    disabled={isLoggingIn}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    disabled={isLoggingIn}
                    className="pr-10"
                  />
                <Button
                    type="button"
                    variant="ghost"
                  size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoggingIn}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                </Button>
              </div>
            </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary text-white shadow-button"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
                </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={isLoggingIn}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </Button>

            <div className="mt-6 text-center">
              <Button 
                variant="ghost"
                className="text-sm text-muted-foreground"
                onClick={() => navigate('/login')}
              >
                Retour à la connexion générale
              </Button>
            </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default AdminCheck;
