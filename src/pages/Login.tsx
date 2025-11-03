import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Smartphone, Loader2, Users, Shield, Clock, UtensilsCrossed, Wallet, QrCode, User } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { agentTokensTopColRef } from "@/lib/collections";
import { getDoc, doc, collectionGroup, query, where, limit, getDocs } from "firebase/firestore";

type LoginType = 'manager' | 'team';
type TeamRole = 'serveur' | 'caissier' | 'agent-evenement';

const Login = () => {
  const [loginType, setLoginType] = useState<LoginType>('manager');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [teamFormData, setTeamFormData] = useState({
    role: '' as TeamRole | '',
    agentCode: ""
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

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormData.role || !teamFormData.agentCode.trim()) {
      toast({ 
        title: "Champs manquants", 
        description: "Veuillez sélectionner un rôle et entrer votre code d'agent", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const agentCode = teamFormData.agentCode.trim().toUpperCase();
      let foundToken: string | null = null;

      // Chercher d'abord dans agentTokensTopColRef par agentCode
      try {
        const byCodeQuery = query(agentTokensTopColRef(db), where('agentCode', '==', agentCode), limit(1));
        const snap = await getDocs(byCodeQuery);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.role === teamFormData.role && data.ownerUid) {
            // Utiliser le token de l'URL ou le code
            foundToken = snap.docs[0].id || agentCode;
          }
        }
      } catch { /* ignore */ }

      // Sinon, chercher dans collectionGroup
      if (!foundToken) {
        try {
          const cg = collectionGroup(db, 'team');
          const byCode = query(cg, where('agentCode', '==', agentCode), limit(1));
          const snap = await getDocs(byCode);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            if (data.role === teamFormData.role) {
              // Utiliser le token si disponible, sinon le code
              foundToken = data.agentToken || agentCode;
            }
          }
        } catch { /* ignore */ }
      }

      if (!foundToken) {
        toast({ 
          title: "Code invalide", 
          description: "Le code d'agent ou le rôle ne correspond pas. Vérifiez avec votre gérant.", 
          variant: "destructive" 
        });
        return;
      }

      // Rediriger vers l'interface appropriée
      if (teamFormData.role === 'serveur') {
        navigate(`/serveur/${foundToken}`);
      } else if (teamFormData.role === 'caissier') {
        navigate(`/caisse/${foundToken}`);
      } else if (teamFormData.role === 'agent-evenement') {
        navigate(`/agent-evenement/${foundToken}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur lors de la connexion.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <NackLogo size="lg" className="mb-3" />
          <p className="text-muted-foreground text-sm">Plateforme de gestion gabonaise</p>
        </div>

        {/* Sélecteur Gérant / Membre d'équipe */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setLoginType('manager')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                loginType === 'manager'
                  ? 'bg-nack-red text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User size={18} />
              <span className="font-medium">Gérant</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginType('team')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                loginType === 'team'
                  ? 'bg-nack-red text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              <span className="font-medium">Équipe</span>
            </button>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">
              {loginType === 'manager' ? 'Se connecter' : 'Connexion équipe'}
            </CardTitle>
            <CardDescription className="text-base">
              {loginType === 'manager' 
                ? 'Accédez à votre espace de gestion'
                : 'Connectez-vous avec votre code d\'agent'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {loginType === 'manager' ? (
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
            ) : (
              <form onSubmit={handleTeamLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Votre rôle</Label>
                  <Select
                    value={teamFormData.role}
                    onValueChange={(value) => setTeamFormData({ ...teamFormData, role: value as TeamRole })}
                    required
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Sélectionnez votre rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serveur">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed size={16} />
                          <span>Serveur</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="caissier">
                        <div className="flex items-center gap-2">
                          <Wallet size={16} />
                          <span>Caissier</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="agent-evenement">
                        <div className="flex items-center gap-2">
                          <QrCode size={16} />
                          <span>Agent Événement</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentCode">Code d'agent</Label>
                  <Input
                    id="agentCode"
                    type="text"
                    placeholder="Entrez votre code d'agent"
                    value={teamFormData.agentCode}
                    onChange={(e) => setTeamFormData({ ...teamFormData, agentCode: e.target.value.toUpperCase() })}
                    required
                    className="h-12 font-mono text-center"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Demandez votre code d'agent à votre gérant
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="nack"
                  size="lg"
                  className="w-full h-12"
                  disabled={isLoading || !teamFormData.role || !teamFormData.agentCode.trim()}
                >
                  {isLoading ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            )}

            {loginType === 'manager' && (
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
            )}
          </CardContent>
        </Card>

        {/* Guide de connexion */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Comment se connecter ?</p>
          <div className="space-y-2 text-xs text-blue-800">
            <div className="flex items-start gap-2">
              <span className="font-bold">Gérant :</span>
              <span>Sélectionnez "Gérant" et connectez-vous avec votre email et mot de passe</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold">Membre d'équipe :</span>
              <span>Sélectionnez "Équipe", choisissez votre rôle et entrez votre code d'agent (donné par votre gérant)</span>
            </div>
            <div className="mt-3 pt-2 border-t border-blue-300">
              <p className="text-xs font-medium text-blue-900">
                💡 Vous pouvez installer l'application sur votre téléphone depuis cette page après connexion
              </p>
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