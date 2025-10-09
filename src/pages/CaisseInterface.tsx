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

const CaisseInterfaceContent = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agentCodeInput, setAgentCodeInput] = useState("");
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [expectedAgentCode, setExpectedAgentCode] = useState<string | null>(null);

  useEffect(() => {
    const resolveOwner = async () => {
      if (!agentCode) return;
      // Try top-level agentTokens mapping first
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string; agentCode?: string };
          if (data.ownerUid) {
            setOwnerUid(data.ownerUid);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent Caissier';
            setAgentInfo({ name, code: agentCode });
            if (data.agentCode) setExpectedAgentCode(data.agentCode);
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
        setIsAuthenticated(true);
      }
    };
    resolveOwner();
  }, [agentCode]);

  const handleAgentLogin = async () => {
    if (!agentCode) return;
    const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
    const input = norm(agentCodeInput);

    // If we already know the expected agent code, accept it; also accept URL token as fallback
    const expected = expectedAgentCode ? norm(expectedAgentCode) : '';
    const tokenOk = norm(agentCode);

    if ((expected && input === expected) || input === tokenOk) {
      setIsAuthenticated(true);
      toast({ title: "Connexion réussie", description: `Bienvenue ${agentInfo?.name || ''}` });
      return;
    }

    // Otherwise, try resolving by entered agent code directly
    try {
      // Prefer public top-level agentTokens lookup by agentCode (no auth required)
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
    <div className="min-h-screen bg-gradient-to-br from-nack-beige-light to-white">
      {!isAuthenticated ? (
      <div className="min-h-screen bg-gradient-to-br from-nack-beige-light to-white flex items-center justify-center">
        <Card className="w-full max-w-md shadow-elegant border-0">
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
        <div>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                <Calculator className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Interface Caisse</h1>
                    <p className="text-sm text-muted-foreground">Code: {agentInfo?.code}</p>
              </div>
            </div>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setIsAuthenticated(false)}>
                <LogOut size={16} className="mr-2" />
                Déconnexion
              </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              {/* Payment Panel (placeholder) */}
          <div className="space-y-6">
            <Card className="shadow-card border-0">
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