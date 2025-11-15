import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { adminDocRef } from "@/lib/collections";
import { getDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertCircle, Loader2, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminCheck = () => {
  const { user, isAdmin, isAdminLoading } = useAuth();
  const { toast } = useToast();
  const [adminDocExists, setAdminDocExists] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  // Log pour débogage - s'assurer que le composant se monte
  useEffect(() => {
    console.log('🔍 AdminCheck monté - URL:', window.location.pathname);
    console.log('🔍 AdminCheck - user:', user?.uid, 'isAdmin:', isAdmin, 'isAdminLoading:', isAdminLoading);
  }, [user, isAdmin, isAdminLoading]);

  useEffect(() => {
    if (user && !isAdminLoading) {
      checkAdminDoc();
      // Si l'utilisateur est admin après connexion, rediriger vers /admin
      if (isAdmin) {
        setTimeout(() => {
          navigate('/admin', { replace: true });
        }, 1000);
      }
    }
  }, [user, isAdminLoading, isAdmin, navigate]);

  const checkAdminDoc = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const adminSnap = await getDoc(adminDocRef(db, user.uid));
      const exists = adminSnap.exists();
      setAdminDocExists(exists);
      
      if (exists) {
        const data = adminSnap.data();
        console.log('Données du document admin:', data);
        
        // Vérifier si updatedAt est incorrect et le corriger
        if (data && data.updatedAt && data.updatedAt < 10000000000) {
          // updatedAt semble être un timestamp incorrect (trop petit)
          console.warn('updatedAt semble incorrect, correction en cours...');
          try {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(adminDocRef(db, user.uid), {
              updatedAt: Date.now(),
            });
            console.log('updatedAt corrigé');
          } catch (updateError) {
            console.error('Erreur correction updatedAt:', updateError);
          }
        }
      }
    } catch (error) {
      console.error('Erreur vérification admin:', error);
      setAdminDocExists(false);
    } finally {
      setChecking(false);
    }
  };

  const createAdminDoc = async () => {
    if (!user) return;
    setCreating(true);
    try {
      await setDoc(adminDocRef(db, user.uid), {
        role: "admin",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      toast({
        title: "✅ Document admin créé !",
        description: "Le document admin a été créé avec succès. Rechargez la page dans quelques secondes.",
      });
      // Vérifier à nouveau après création
      setTimeout(() => {
        checkAdminDoc();
      }, 1000);
    } catch (error: any) {
      console.error('Erreur création admin:', error);
      toast({
        title: "❌ Erreur",
        description: error?.message || "Impossible de créer le document admin. Vérifiez les permissions Firestore.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  // Afficher la page même sans utilisateur connecté pour permettre le diagnostic
  // L'utilisateur pourra se connecter depuis cette page si nécessaire

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Diagnostic Admin
          </CardTitle>
          <CardDescription>Vérification de votre statut administrateur</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">Utilisateur connecté</span>
              {user ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
            </div>

            {user && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex-1">
                  <span className="font-semibold text-blue-900 block mb-1">Votre UID (Important !)</span>
                  <span className="text-xs text-blue-700">Copiez cet UID pour créer votre document admin</span>
                </div>
                <div className="ml-4">
                  <code className="block bg-blue-100 px-3 py-2 rounded text-xs font-mono text-blue-900 border border-blue-300 break-all max-w-xs">
                    {user.uid}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(user.uid);
                      toast({ title: "UID copié !", description: "L'UID a été copié dans le presse-papiers" });
                    }}
                  >
                    📋 Copier l'UID
                  </Button>
                </div>
              </div>
            )}
            
            {!user && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg space-y-4">
                <div>
                  <p className="font-semibold text-yellow-900 mb-2">⚠️ Vous n'êtes pas connecté</p>
                  <p className="text-sm text-yellow-800 mb-3">
                    Connectez-vous avec votre compte admin pour accéder au tableau de bord administrateur.
                  </p>
                </div>
                
                {!showLoginForm ? (
                  <div className="space-y-2">
                    <Button onClick={() => setShowLoginForm(true)} className="w-full bg-gradient-primary text-white shadow-button">
                      <Mail className="w-4 h-4 mr-2" />
                      Se connecter en tant qu'admin
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/login')} 
                      className="w-full"
                    >
                      Aller à la page de connexion générale
                    </Button>
                  </div>
                ) : (
                  <Card className="border-yellow-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Connexion Admin</CardTitle>
                      <CardDescription>Connectez-vous avec votre compte administrateur</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setIsLoggingIn(true);
                        try {
                          await signInWithEmail(loginData.email, loginData.password);
                          toast({ 
                            title: "Connexion réussie !", 
                            description: "Vérification de votre statut admin..." 
                          });
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
                      }}>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="admin-email">Email</Label>
                            <Input
                              id="admin-email"
                              type="email"
                              placeholder="admin@example.com"
                              value={loginData.email}
                              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                              required
                              disabled={isLoggingIn}
                            />
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
                          <div className="flex gap-2">
                            <Button 
                              type="submit" 
                              className="flex-1 bg-gradient-primary text-white shadow-button"
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
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                setIsLoggingIn(true);
                                try {
                                  await signInWithGoogle();
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
                              }}
                              disabled={isLoggingIn}
                            >
                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                              Google
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="flex-1 text-sm"
                              onClick={() => {
                                setShowLoginForm(false);
                                setLoginData({ email: "", password: "" });
                              }}
                              disabled={isLoggingIn}
                            >
                              Annuler
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1 text-sm"
                              onClick={() => navigate('/register')}
                              disabled={isLoggingIn}
                            >
                              Créer un compte
                            </Button>
                          </div>
                          <p className="text-xs text-center text-muted-foreground">
                            Pas encore de compte ? Créez-en un, puis utilisez la page de diagnostic pour créer votre document admin.
                          </p>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {user && (
              <>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Statut Admin (AuthContext)</span>
                  {isAdminLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAdmin ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>Oui</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-4 h-4" />
                      <span>Non</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Document Admin (Firestore)</span>
                  {checking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : adminDocExists === null ? (
                    <span className="text-muted-foreground">Non vérifié</span>
                  ) : adminDocExists ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>Existe</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-4 h-4" />
                      <span>N'existe pas</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {user && (
            <div className="pt-4 border-t space-y-2">
              <h3 className="font-semibold">Instructions pour devenir admin :</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="font-semibold text-blue-900 mb-2">Méthode 1 : Script (Recommandé)</p>
                  <p className="text-sm text-blue-800 mb-2">Exécutez cette commande dans le terminal :</p>
                  <code className="block bg-blue-100 p-2 rounded text-xs break-all">
                    node scripts/promoteAdmin.mjs {user.uid}
                  </code>
                  <p className="text-xs text-blue-700 mt-2">
                    ⚠️ Assurez-vous d'avoir configuré FIREBASE_PROJECT_ID et SERVICE_ACCOUNT_JSON
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="font-semibold text-green-900 mb-2">Méthode 2 : Firebase Console (Manuel - Plus simple)</p>
                  <div className="bg-white border border-green-300 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-green-900 mb-2">📍 Votre UID à utiliser :</p>
                    <code className="block bg-green-50 px-2 py-1 rounded text-xs font-mono text-green-900 border border-green-200 break-all">
                      {user.uid}
                    </code>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-green-800">
                    <li className="mb-2">
                      Allez sur <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Firebase Console</a> (ouvre dans un nouvel onglet)
                    </li>
                    <li className="mb-2">Sélectionnez le projet : <strong className="bg-green-100 px-2 py-1 rounded">nack-8c299</strong></li>
                    <li className="mb-2">Dans le menu de gauche, cliquez sur <strong>"Firestore Database"</strong></li>
                    <li className="mb-2">
                      Si la collection <code className="bg-green-100 px-1 rounded">admins</code> n'existe pas :
                      <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                        <li>Cliquez sur "Créer une collection"</li>
                        <li>Nom de la collection : <code className="bg-green-100 px-1 rounded">admins</code></li>
                        <li>Cliquez sur "Suivant" puis "Terminé"</li>
                      </ul>
                    </li>
                    <li className="mb-2">
                      Cliquez sur "Ajouter un document" dans la collection <code className="bg-green-100 px-1 rounded">admins</code>
                    </li>
                    <li className="mb-2">
                      Dans "ID du document", collez votre UID : <code className="bg-green-100 px-1 rounded break-all text-xs">{user.uid}</code>
                    </li>
                    <li className="mb-2">
                      Ajoutez ces 3 champs (cliquez sur "Ajouter un champ" pour chacun) :
                      <ul className="list-disc list-inside ml-4 mt-1 text-xs space-y-1">
                        <li><code className="bg-green-100 px-1 rounded">role</code> (type: string) = <code className="bg-green-100 px-1 rounded">"admin"</code></li>
                        <li><code className="bg-green-100 px-1 rounded">createdAt</code> (type: number) = <code className="bg-green-100 px-1 rounded">{Date.now()}</code></li>
                        <li><code className="bg-green-100 px-1 rounded">updatedAt</code> (type: number) = <code className="bg-green-100 px-1 rounded">{Date.now()}</code></li>
                      </ul>
                    </li>
                    <li className="mb-2">Cliquez sur "Enregistrer"</li>
                  </ol>
                  <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-xs text-green-900">
                    <strong>💡 Astuce :</strong> Vous pouvez copier votre UID ci-dessus et le coller directement dans Firebase Console.
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Après avoir créé le document admin, rechargez cette page.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={checkAdminDoc} disabled={checking || !user}>
              {checking ? "Vérification..." : "Vérifier à nouveau"}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin')} disabled={!user}>
              Essayer d'accéder à /admin
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Aller au Dashboard
            </Button>
          </div>

          {adminDocExists && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <strong>✅ Document admin trouvé !</strong>
              <br />
              Le document existe dans Firestore. Si vous ne pouvez toujours pas accéder à /admin, essayez :
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Déconnectez-vous et reconnectez-vous</li>
                <li>Videz le cache du navigateur (Ctrl+Shift+Delete)</li>
                <li>Attendez quelques secondes pour la synchronisation</li>
                <li>Vérifiez la console du navigateur (F12) pour les erreurs</li>
              </ul>
            </div>
          )}
          
          {adminDocExists === false && user && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 space-y-3">
              <div>
                <strong>⚠️ Problème détecté :</strong> Le document admin n'existe pas dans Firestore.
                <br />
                <div className="mt-2 space-y-1">
                  <div>
                    <strong>Collection:</strong> <code className="bg-yellow-100 px-1 rounded">admins</code>
                  </div>
                  <div>
                    <strong>Document ID (votre UID):</strong>
                    <div className="mt-1">
                      <code className="bg-yellow-100 px-2 py-1 rounded text-xs font-mono break-all block">
                        {user.uid}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(user.uid);
                          toast({ title: "UID copié !", description: "L'UID a été copié dans le presse-papiers" });
                        }}
                      >
                        📋 Copier l'UID
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-yellow-300">
                <p className="font-semibold mb-2">💡 Solution rapide :</p>
                <Button 
                  onClick={createAdminDoc} 
                  disabled={creating}
                  className="w-full sm:w-auto"
                >
                  {creating ? "Création en cours..." : "Créer automatiquement le document admin"}
                </Button>
                <p className="text-xs mt-2 text-yellow-700">
                  ⚠️ Cette action nécessite que les règles Firestore soient déployées. Si cela échoue, utilisez Firebase Console (méthode 2 ci-dessus).
                </p>
              </div>
            </div>
          )}
          
          {adminDocExists && !isAdmin && !isAdminLoading && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 space-y-3">
              <div>
                <strong>⚠️ Problème de synchronisation :</strong>
                <br />
                Le document existe mais AuthContext ne détecte pas le statut admin.
                <br />
                Cela peut être dû à un problème de cache ou de synchronisation Firestore.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    checkAdminDoc();
                    setTimeout(() => window.location.reload(), 2000);
                  }}
                >
                  Vérifier et recharger
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Recharger la page
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/admin')}
                >
                  Forcer l'accès à /admin
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCheck;

