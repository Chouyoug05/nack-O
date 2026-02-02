import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import { affiliateDocRef } from "@/lib/collections";
import { getDoc } from "firebase/firestore";
import type { AffiliateDoc } from "@/types/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, QrCode, Users, Loader2, Copy } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import QRCode from "qrcode";

const baseUrl = typeof window !== "undefined" ? `${window.location.origin}${(import.meta.env?.BASE_URL || "").replace(/\/$/, "")}` : "";

const AffiliateDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get("code")?.trim().toUpperCase();
  const [inputCode, setInputCode] = useState(codeParam || "");
  const [affiliate, setAffiliate] = useState<AffiliateDoc | null>(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = codeParam || (affiliate?.code ?? "");

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setAffiliate(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getDoc(affiliateDocRef(db, code))
      .then((snap) => {
        if (snap.exists()) {
          setAffiliate({ id: snap.id, ...snap.data() } as AffiliateDoc);
        } else {
          setAffiliate(null);
          setError("Code affilié introuvable.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger les données.");
        setAffiliate(null);
      })
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!affiliate?.code) return;
    const registerUrl = `${baseUrl}/register?ref=${encodeURIComponent(affiliate.code)}`;
    QRCode.toDataURL(registerUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [affiliate?.code]);

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const c = inputCode.trim().toUpperCase();
    if (!c) return;
    setSearchParams({ code: c });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Chargement de votre espace affilié...</p>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <NackLogo size="md" className="mb-2" />
            <p className="text-muted-foreground text-sm">Espace affilié Nack</p>
          </div>
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Connexion affilié</CardTitle>
              <CardDescription>
                Entrez le code affilié qui vous a été communiqué pour accéder à vos statistiques.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code affilié</Label>
                  <Input
                    id="code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Ex: AFF001"
                    className="font-mono uppercase"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!inputCode.trim()}>
                  Accéder à mon espace
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  if (error || !affiliate) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <NackLogo size="md" className="mb-2" />
          </div>
          <Card className="shadow-card border-0">
            <CardContent className="pt-6">
              <p className="text-destructive text-center mb-4">{error || "Code inconnu."}</p>
              <Button variant="outline" className="w-full" onClick={() => setSearchParams({})}>
                Saisir un autre code
              </Button>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  const registerUrl = `${baseUrl}/register?ref=${encodeURIComponent(affiliate.code)}`;
  const count = affiliate.referralCount ?? 0;

  return (
    <div className="min-h-screen bg-gradient-secondary p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <NackLogo size="sm" />
            <span className="text-muted-foreground text-sm">Espace affilié</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
            Changer de code
          </Button>
        </div>

        <Card className="shadow-card border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              {affiliate.name}
            </CardTitle>
            <CardDescription>
              Code affilié : <strong className="font-mono text-foreground">{affiliate.code}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Building2 size={32} className="text-primary" />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">établissement(s) inscrit(s) avec votre code</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode size={20} />
              Inscription par QR code
            </CardTitle>
            <CardDescription>
              Partagez ce QR code ou le lien pour que les établissements s'inscrivent avec votre code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            {qrDataUrl && (
              <div className="flex-shrink-0">
                <img src={qrDataUrl} alt="QR code inscription" className="w-48 h-48 rounded-lg border bg-white p-2" />
              </div>
            )}
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-muted-foreground">Lien d'inscription</Label>
              <div className="flex gap-2">
                <Input readOnly value={registerUrl} className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  title="Copier le lien"
                  onClick={() => {
                    navigator.clipboard.writeText(registerUrl);
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Les nouveaux établissements qui s'inscrivent via ce lien seront comptés dans vos statistiques.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
