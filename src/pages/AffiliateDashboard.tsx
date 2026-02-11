import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import { affiliateDocRef, profilesColRef } from "@/lib/collections";
import { getDoc, query, where, getDocs } from "firebase/firestore";
import type { AffiliateDoc, UserProfile } from "@/types/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, QrCode, Users, Loader2, Copy, Wallet, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const baseUrl = typeof window !== "undefined" ? `${window.location.origin}${(import.meta.env?.BASE_URL || "").replace(/\/$/, "")}` : "";

const AffiliateDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get("code")?.trim().toUpperCase();
  const [inputCode, setInputCode] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [affiliate, setAffiliate] = useState<AffiliateDoc | null>(null);
  const [referrals, setReferrals] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Session simple: on stocke le code validé en localStorage
  const [sessionCode, setSessionCode] = useState<string | null>(() => {
    return localStorage.getItem("nack_affiliate_session");
  });

  const activeCode = codeParam || sessionCode;

  const fetchReferrals = async (affiliateCode: string) => {
    try {
      const q = query(profilesColRef(db), where("referredBy", "==", affiliateCode));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setReferrals(list);
    } catch (err) {
      console.error("Erreur lors de la récupération des parrainages:", err);
    }
  };

  useEffect(() => {
    if (!activeCode) {
      setLoading(false);
      setAffiliate(null);
      setReferrals([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getDoc(affiliateDocRef(db, activeCode))
      .then((snap) => {
        if (snap.exists()) {
          setAffiliate({ id: snap.id, ...snap.data() } as AffiliateDoc);
          fetchReferrals(activeCode);
        } else {
          // Si le code n'est pas trouvé et qu'on a une "session", on la vide
          if (sessionCode === activeCode) {
            setSessionCode(null);
            localStorage.removeItem("nack_affiliate_session");
          }
          setAffiliate(null);
          setReferrals([]);
          setError("Session ou code invalide.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Erreur de connexion aux serveurs.");
        setAffiliate(null);
      })
      .finally(() => setLoading(false));
  }, [activeCode]); // Utilise activeCode (code URL ou session)

  useEffect(() => {
    if (!affiliate?.code) return;
    const registerUrl = `${baseUrl}/register?ref=${encodeURIComponent(affiliate.code)}`;
    QRCode.toDataURL(registerUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [affiliate?.code]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = inputCode.trim();
    const password = inputPassword.trim();
    if (!identifier || !password) return;

    setLoginLoading(true);
    setError(null);

    try {
      let affiliateDoc: AffiliateDoc | null = null;
      let codeToUse = identifier.toUpperCase();

      // 1. Essayer par code directement
      const directSnap = await getDoc(affiliateDocRef(db, codeToUse));
      if (directSnap.exists()) {
        affiliateDoc = { id: directSnap.id, ...directSnap.data() } as AffiliateDoc;
      } else {
        // 2. Essayer par numéro WhatsApp
        const { affiliatesColRef } = await import("@/lib/collections");
        const q = query(affiliatesColRef(db), where("whatsapp", "==", identifier));
        const snap = await getDocs(q);
        if (!snap.empty) {
          affiliateDoc = { id: snap.docs[0].id, ...snap.docs[0].data() } as AffiliateDoc;
          codeToUse = affiliateDoc.code;
        }
      }

      if (affiliateDoc && (!affiliateDoc.password || affiliateDoc.password === password)) {
        // Succès
        localStorage.setItem("nack_affiliate_session", codeToUse);
        setSessionCode(codeToUse);
        setSearchParams({ code: codeToUse });
      } else if (affiliateDoc) {
        setError("Mot de passe incorrect.");
      } else {
        setError("Identifiant (code ou numéro) inconnu.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la connexion.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nack_affiliate_session");
    setSessionCode(null);
    setSearchParams({});
    setAffiliate(null);
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

  if (!activeCode || (!loading && !affiliate)) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <NackLogo size="md" variant="affiliate" className="mb-2" />
            <p className="text-muted-foreground text-sm font-medium">Espace Partenaire Nack</p>
          </div>
          <Card className="shadow-card border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Connexion Affilié</CardTitle>
              <CardDescription>
                Accédez à votre tableau de bord sécurisé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="id">Code ou Numéro WhatsApp</Label>
                  <Input
                    id="id"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Ex: AFF-XXXX ou +241..."
                    className="h-12"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass">Mot de passe</Label>
                  <Input
                    id="pass"
                    type="password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12"
                  />
                </div>
                {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                <Button type="submit" className="w-full h-12 text-base font-bold bg-nack-red hover:bg-nack-red-dark" disabled={loginLoading || !inputCode.trim() || !inputPassword.trim()}>
                  {loginLoading ? <Loader2 className="animate-spin mr-2" /> : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="text-center space-y-3 mt-6">
            <p className="text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link to="/register?mode=affiliate" className="text-nack-red font-bold hover:underline">Devenir partenaire</Link>
            </p>
            <Link to="/" className="text-xs text-muted-foreground hover:underline block">Retour à l'accueil nack!</Link>
          </div>
        </div>
      </div>
    );
  }

  // Suppression du bloc d'erreur séparé car handleLogin/activeCode gèrent tout

  const registerUrl = `${baseUrl}/register?ref=${encodeURIComponent(affiliate.code)}`;
  const count = affiliate.referralCount ?? 0;
  const totalEarned = affiliate.totalEarned ?? 0;

  return (
    <div className="min-h-screen bg-gradient-secondary p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <NackLogo size="sm" variant="affiliate" />
            <span className="text-muted-foreground text-sm">Espace affilié</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            Se déconnecter
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
                <p className="text-2xl font-bold">{referrals.length || count}</p>
              </Card>

              {/* Bloc Communauté WhatsApp */}
              <Card className="shadow-card border-0 mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-100 shrink-0">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="bg-white p-3 rounded-2xl shadow-sm shrink-0">
                      <Smartphone className="text-emerald-600 w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-emerald-900">Rejoignez la Communauté NACK!</h3>
                      <p className="text-sm text-emerald-800/80">
                        Suivez notre chaîne officielle pour recevoir des guides, des conseils d'expert et des cadeaux exclusifs.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-6 rounded-xl w-full sm:w-auto"
                    >
                      <a href="https://whatsapp.com/channel/0029Vb7K9Ul9hXF1FhgeES0C" target="_blank" rel="noopener noreferrer">
                        Rejoindre la chaîne
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Liste des parrainages */}
              <Card className="shadow-card border-0 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 size={20} />
                    Établissements parrainés
                  </CardTitle>
                  <CardDescription>
                    Suivez l'état des abonnements de vos parrainages.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Aucun établissement n'est encore inscrit avec votre code.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {referrals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((ref) => {
                        const isExpired = ref.plan === 'expired';
                        const isActive = ref.plan === 'active';
                        const isTrial = ref.plan === 'trial';

                        return (
                          <div key={ref.uid} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{ref.establishmentName}</p>
                              <p className="text-xs text-muted-foreground">Inscrit le {new Date(ref.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-4">
                              <Badge variant={isActive ? "success" : isTrial ? "secondary" : "destructive"} className="whitespace-nowrap">
                                {isActive ? (
                                  <><CheckCircle2 size={12} className="mr-1" /> Payé</>
                                ) : isTrial ? (
                                  <><Clock size={12} className="mr-1" /> Essai gratuit</>
                                ) : (
                                  <><AlertCircle size={12} className="mr-1" /> Expiré</>
                                )}
                              </Badge>
                              {ref.subscriptionEndsAt && (
                                <p className="text-[10px] text-muted-foreground">
                                  Expire le {new Date(ref.subscriptionEndsAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
