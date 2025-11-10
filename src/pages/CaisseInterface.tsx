import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import OrderManagement from "@/components/OrderManagement";
import { 
  LogOut,
  Calculator
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collectionGroup, getDocs, limit, query, where, doc, getDoc } from "firebase/firestore";
import { agentTokensTopColRef } from "@/lib/collections";

const getAuthStorageKey = (agentCode: string) => `nack_caisse_auth_${agentCode}`;

const CaisseInterfaceContent = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Restaurer l'état d'authentification depuis localStorage
    if (!agentCode) return false;
    try {
      const stored = localStorage.getItem(getAuthStorageKey(agentCode));
      if (stored) {
        const data = JSON.parse(stored);
        // Vérifier que la session n'est pas trop ancienne (24h max)
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return true;
        } else {
          localStorage.removeItem(getAuthStorageKey(agentCode));
        }
      }
    } catch { /* ignore */ }
    return false;
  });
  const [agentCodeInput, setAgentCodeInput] = useState("");
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [expectedAgentCode, setExpectedAgentCode] = useState<string | null>(null);

  useEffect(() => {
    const resolveOwner = async () => {
      if (!agentCode) return;
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string; agentCode?: string };
          if (data.ownerUid) {
            setOwnerUid(data.ownerUid);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent Caissier';
            setAgentInfo({ name, code: agentCode });
            if (data.agentCode) setExpectedAgentCode(data.agentCode);
            // Sauvegarder l'authentification dans localStorage
            try {
              localStorage.setItem(getAuthStorageKey(agentCode), JSON.stringify({
                authenticated: true,
                timestamp: Date.now(),
                ownerUid: data.ownerUid,
                agentName: name,
              }));
            } catch { /* ignore */ }
            setIsAuthenticated(true);
            return;
          }
        }
      } catch { /* ignore */ }

      const cg = collectionGroup(db, 'team');
      let foundOwner: string | null = null;
      let foundName: string | null = null;
      let foundAgentCode: string | null = null;
      const byToken = query(cg, where('agentToken', '==', agentCode), limit(1));
      const s1 = await getDocs(byToken);
      if (!s1.empty) {
        const docSnap = s1.docs[0];
        const data = docSnap.data() as { firstName?: string; lastName?: string; agentCode?: string };
        foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
        foundName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent Caissier';
        foundAgentCode = data.agentCode || null;
      } else {
        const byCode = query(cg, where('agentCode', '==', agentCode), limit(1));
        const s2 = await getDocs(byCode);
        if (!s2.empty) {
          const docSnap = s2.docs[0];
          const data = docSnap.data() as { firstName?: string; lastName?: string; agentCode?: string };
          foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
          foundName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent Caissier';
          foundAgentCode = data.agentCode || null;
        }
      }
      if (foundOwner) {
        setOwnerUid(foundOwner);
        setAgentInfo({ name: foundName || 'Agent Caissier', code: agentCode });
        if (foundAgentCode) setExpectedAgentCode(foundAgentCode);
        // Sauvegarder l'authentification dans localStorage
        try {
          localStorage.setItem(getAuthStorageKey(agentCode), JSON.stringify({
            authenticated: true,
            timestamp: Date.now(),
            ownerUid: foundOwner,
            agentName: foundName || 'Agent Caissier',
          }));
        } catch { /* ignore */ }
        setIsAuthenticated(true);
      }
    };
    resolveOwner();
  }, [agentCode]);

  // Restaurer les informations depuis localStorage si authentifié
  useEffect(() => {
    if (isAuthenticated && agentCode && !ownerUid) {
      try {
        const stored = localStorage.getItem(getAuthStorageKey(agentCode));
        if (stored) {
          const data = JSON.parse(stored);
          if (data.ownerUid && data.agentName) {
            setOwnerUid(data.ownerUid);
            setAgentInfo({ name: data.agentName, code: agentCode });
            // Les données sont restaurées, resolveOwner() sera appelé automatiquement par le premier useEffect
          }
        }
      } catch { /* ignore */ }
    }
  }, [isAuthenticated, agentCode, ownerUid]);

  const handleAgentLogin = async () => {
    if (!agentCode) return;
    const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
    const input = norm(agentCodeInput);

    const expected = expectedAgentCode ? norm(expectedAgentCode) : '';
    const tokenOk = norm(agentCode);

    if ((expected && input === expected) || input === tokenOk) {
      // Sauvegarder l'authentification
      try {
        localStorage.setItem(getAuthStorageKey(agentCode), JSON.stringify({
          authenticated: true,
          timestamp: Date.now(),
          ownerUid: ownerUid || '',
          agentName: agentInfo?.name || 'Agent Caissier',
        }));
      } catch { /* ignore */ }
      setIsAuthenticated(true);
      toast({ title: "Connexion réussie", description: `Bienvenue ${agentInfo?.name || ''}` });
      return;
    }

    try {
      const byCodeToken = query(agentTokensTopColRef(db), where('agentCode', '==', agentCodeInput.trim()), limit(1));
      const sTok = await getDocs(byCodeToken);
      if (!sTok.empty) {
        const snap = sTok.docs[0];
        const data = snap.data() as { ownerUid?: string; firstName?: string; lastName?: string; agentCode?: string };
        if (data.ownerUid) {
          setOwnerUid(data.ownerUid);
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent Caissier';
          setAgentInfo({ name, code: agentCode });
          if (data.agentCode) setExpectedAgentCode(data.agentCode);
          // Sauvegarder l'authentification
          try {
            localStorage.setItem(getAuthStorageKey(agentCode), JSON.stringify({
              authenticated: true,
              timestamp: Date.now(),
              ownerUid: data.ownerUid,
              agentName: name,
            }));
          } catch { /* ignore */ }
          setIsAuthenticated(true);
          toast({ title: "Connexion réussie", description: `Bienvenue ${name}` });
        return;
      }
    }
    } catch { /* ignore lookup errors */ }

    toast({ title: "Code incorrect", description: "Veuillez saisir le bon code d'agent", variant: "destructive" });
  };

  if (!agentCode) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-[#f6f8f6]">
      {!isAuthenticated ? (
        <div className="min-h-screen bg-[#f6f8f6] flex items-center justify-center p-4">
          <Card className="w-full max-w-md border border-gray-200 bg-white shadow-sm">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Calculator className="text-white" size={28} />
              </div>
              <CardTitle>Interface Caisse</CardTitle>
              <CardDescription>
                  Veuillez saisir votre numéro d'agent (format AGT-XXXX-XXXX)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agentCode">Numéro d'agent</Label>
                <Input
                  id="agentCode"
                  value={agentCodeInput}
                  onChange={(e) => setAgentCodeInput(e.target.value)}
                    placeholder="AGT-XXXX-XXXX"
                  className="text-center font-mono"
                />
              </div>
              <Button 
                onClick={handleAgentLogin}
                className="w-full bg-gradient-primary text-white shadow-button h-12"
              >
                Se connecter
              </Button>
                {expectedAgentCode && (
                  <p className="text-xs text-center text-muted-foreground">
                    Indice: commence par {expectedAgentCode.slice(0, 4)}...
                  </p>
                )}
                {!expectedAgentCode && (
              <p className="text-xs text-center text-muted-foreground">
                    Astuce: ré-ouvrez ce lien depuis "Équipe" pour auto-connexion.
              </p>
                )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f6]/80 p-4 md:p-6 pb-2 backdrop-blur-sm border-b border-gray-200/50">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                <Calculator className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl lg:text-2xl font-bold leading-tight tracking-[-0.015em] text-gray-900">
                  Interface Caisse
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">Code: {agentInfo?.code}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200" 
              onClick={() => {
                // Supprimer l'authentification sauvegardée
                if (agentCode) {
                  try {
                    localStorage.removeItem(getAuthStorageKey(agentCode));
                  } catch { /* ignore */ }
                }
                setIsAuthenticated(false);
                setOwnerUid(null);
                setAgentInfo(null);
              }}
            >
              <LogOut size={16} className="mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
                {/* Orders from Servers */}
                <div>
                  <OrderManagement 
                    title="Commandes à encaisser"
                    description="Commandes envoyées par les serveurs"
                    showActions={true}
                    ownerOverrideUid={ownerUid || undefined}
                    agentToken={agentInfo?.code}
                  />
                </div>

                {/* Payment Panel */}
                <div className="space-y-4 md:space-y-6">
                  <Card className="border border-gray-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle>Mode de paiement</CardTitle>
                      <CardDescription>Sélectionnez le mode de paiement lors de la validation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">La validation côté droite déclenche l'encaissement.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

const CaisseInterface = () => {
  return (
    <CaisseInterfaceContent />
  );
};

export default CaisseInterface;
