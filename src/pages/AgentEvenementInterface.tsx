import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import NackLogo from "@/components/NackLogo";
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users,
  Ticket,
  BarChart3,
  Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { eventTicketsColRef, eventsColRef, teamColRef } from "@/lib/collections";
import { collection, doc as fsDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import type { TicketDoc } from "@/types/event";

interface FirestoreTeamMemberDoc { firstName: string; lastName: string; agentToken?: string; agentCode?: string; }

const getAgentEventAuthKey = (agentCode: string, userId?: string) => `nack_agent_event_auth_${agentCode}_${userId || 'anonymous'}`;

const AgentEvenementInterface = () => {
  const { agentCode } = useParams<{ agentCode: string }>();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [agentName, setAgentName] = useState<string>(() => {
    // Restaurer depuis localStorage
    if (!agentCode) return "";
    try {
      const stored = localStorage.getItem(getAgentEventAuthKey(agentCode, user?.uid));
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.agentName || "";
        } else {
          localStorage.removeItem(getAgentEventAuthKey(agentCode, user?.uid));
        }
      }
    } catch { /* ignore */ }
    return "";
  });
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [tickets, setTickets] = useState<Array<{ id: string; data: TicketDoc }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validate = async () => {
      if (authLoading) return; // Attendre que l'auth soit chargé
      if (!agentCode) {
        setLoading(false);
        return;
      }
      
      // Si on a déjà un agentName depuis localStorage et user existe, on peut continuer
      if (agentName && user) {
        setLoading(false);
        return;
      }
      
      if (!user) {
        // Si pas de user mais qu'on a un agentName sauvegardé, on peut quand même afficher
        if (agentName) {
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }
      
      // token first
      const byToken = query(teamColRef(db, user.uid), where('agentToken', '==', agentCode), limit(1));
      const s1 = await getDocs(byToken);
      if (!s1.empty) {
        const d = s1.docs[0].data() as FirestoreTeamMemberDoc;
        const name = `${d.firstName} ${d.lastName}`;
        setAgentName(name);
        // Sauvegarder dans localStorage
        try {
          localStorage.setItem(getAgentEventAuthKey(agentCode, user.uid), JSON.stringify({
            agentName: name,
            timestamp: Date.now(),
          }));
        } catch { /* ignore */ }
      } else {
        const byCode = query(teamColRef(db, user.uid), where('agentCode', '==', agentCode), limit(1));
        const s2 = await getDocs(byCode);
        if (!s2.empty) {
          const d = s2.docs[0].data() as FirestoreTeamMemberDoc;
          const name = `${d.firstName} ${d.lastName}`;
          setAgentName(name);
          // Sauvegarder dans localStorage
          try {
            localStorage.setItem(getAgentEventAuthKey(agentCode, user.uid), JSON.stringify({
              agentName: name,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
    };
    validate();
  }, [agentCode, user, authLoading, agentName]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(eventsColRef(db, user.uid), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, title: d.data().title as string }));
      setEvents(list);
      if (!selectedEventId && list.length > 0) setSelectedEventId(list[0].id);
    });
    return () => unsub();
  }, [user, selectedEventId]);

  useEffect(() => {
    if (!user || !selectedEventId) { setTickets([]); return; }
    const q = query(eventTicketsColRef(db, user.uid, selectedEventId), orderBy('purchaseDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, data: d.data() as TicketDoc }));
      setTickets(list);
    });
    return () => unsub();
  }, [user, selectedEventId]); // selectedEventId est déjà dans les dépendances

  const toggleValidate = async (ticketId: string, validated: boolean) => {
    if (!user || !selectedEventId) return;
    try {
      await updateDoc(fsDoc(eventTicketsColRef(db, user.uid, selectedEventId), ticketId), {
        validated,
        validatedAt: validated ? Date.now() : null,
      });
    } catch {
      toast({ title: 'Erreur', description: "Impossible de mettre à jour le ticket", variant: 'destructive' });
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 flex items-center justify-center">
        <NackLogo size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <NackLogo size="md" />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-foreground">Interface Agent Événement</h1>
            <p className="text-muted-foreground">Agent: {agentName || agentCode}</p>
          </div>
        </div>

        {/* Event selector */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Sélection de l'événement</CardTitle>
            <CardDescription>Choisissez l'événement pour voir les participants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {events.map(e => (
                <Button key={e.id} variant={selectedEventId === e.id ? 'default' : 'outline'} onClick={() => setSelectedEventId(e.id)}>
                  {e.title}
              </Button>
              ))}
              {events.length === 0 && <p className="text-sm text-muted-foreground">Aucun événement</p>}
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle>Participants</CardTitle>
            <CardDescription>Validez les billets à l'entrée</CardDescription>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket size={48} className="mx-auto mb-4 opacity-50" />
                <p>Aucun participant pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.data.customerName} • {t.data.customerPhone}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.data.purchaseDate).toLocaleString()} • {t.data.quantity} billet(s) • {t.data.totalAmount.toLocaleString()} XAF
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.data.validated ? (
                        <Badge className="bg-green-600">Validé</Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
                      <Button
                        variant={t.data.validated ? 'outline' : 'default'}
                        onClick={() => toggleValidate(t.id, !t.data.validated)}
                      >
                        {t.data.validated ? 'Annuler' : 'Valider'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentEvenementInterface;
