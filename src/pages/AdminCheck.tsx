import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { adminDocRef } from "@/lib/collections";
import { getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

const AdminCheck = () => {
  const { user, isAdmin, isAdminLoading } = useAuth();
  const [adminDocExists, setAdminDocExists] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isAdminLoading) {
      checkAdminDoc();
    }
  }, [user, isAdminLoading]);

  const checkAdminDoc = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const adminSnap = await getDoc(adminDocRef(db, user.uid));
      setAdminDocExists(adminSnap.exists());
    } catch (error) {
      console.error('Erreur vérification admin:', error);
      setAdminDocExists(false);
    } finally {
      setChecking(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Vérification Admin</CardTitle>
            <CardDescription>Vous devez être connecté</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')}>Se connecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">UID</span>
              <span className="text-xs font-mono text-muted-foreground">{user.uid}</span>
            </div>

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
          </div>

          <div className="pt-4 border-t space-y-2">
            <h3 className="font-semibold">Instructions pour devenir admin :</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Exécutez le script : <code className="bg-muted px-1 rounded">node scripts/promoteAdmin.mjs {user.uid}</code></li>
              <li>Assurez-vous d'avoir configuré les variables d'environnement nécessaires</li>
              <li>Rechargez cette page après avoir exécuté le script</li>
            </ol>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={checkAdminDoc} disabled={checking}>
              {checking ? "Vérification..." : "Vérifier à nouveau"}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Essayer d'accéder à /admin
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Aller au Dashboard
            </Button>
          </div>

          {adminDocExists === false && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Problème détecté :</strong> Le document admin n'existe pas dans Firestore.
              <br />
              Collection: <code className="bg-yellow-100 px-1 rounded">admins</code>
              <br />
              Document ID: <code className="bg-yellow-100 px-1 rounded">{user.uid}</code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCheck;

