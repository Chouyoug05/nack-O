import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  listAllSupportTickets,
  listAllTablets,
  replySupportTicket,
  type SupportTicketDoc,
  type TabletDoc,
} from "@/lib/tabletsSupport";
import { doc, updateDoc } from "firebase/firestore";
import { supportTicketsColRef } from "@/lib/collections";
import { MessageCircle, Smartphone } from "lucide-react";

function formatWhen(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return "—";
  }
}

export function AdminTabletsView({ search }: { search: string }) {
  const [tablets, setTablets] = useState<Array<TabletDoc & { id: string }>>([]);

  useEffect(() => {
    listAllTablets(db).then(setTablets).catch(() => setTablets([]));
  }, []);

  const filtered = tablets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.imei || t.id || "").toLowerCase().includes(q) ||
      (t.establishmentName || "").toLowerCase().includes(q) ||
      (t.ownerName || "").toLowerCase().includes(q) ||
      (t.ownerUid || "").toLowerCase().includes(q)
    );
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone size={20} />
          Tablettes enregistrées ({filtered.length})
        </CardTitle>
        <CardDescription>Suivi IMEI de toutes les tablettes NACK Pro</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tablette enregistrée.</p>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 space-y-1">
              <div className="font-semibold">{t.establishmentName || t.ownerName || "Établissement"}</div>
              <div className="text-sm">{t.label || "Tablette"} • IMEI <span className="font-mono">{t.imei || t.id}</span></div>
              <div className="text-xs text-muted-foreground">
                {t.ownerName || "—"} • {t.email || t.whatsapp || t.ownerUid} • Dernière activité {formatWhen(t.lastSeenAt)}
              </div>
              <Badge variant="secondary">{t.status || "active"}</Badge>
              {t.assignedByAdmin && (
                <Badge className="ml-2 bg-nack-red/10 text-nack-red border-nack-red/20">Assignée admin</Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSupportView({ search }: { search: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Array<SupportTicketDoc & { id: string }>>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const reload = () => {
    listAllSupportTickets(db).then(setTickets).catch(() => setTickets([]));
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.subject || "").toLowerCase().includes(q) ||
      (t.message || "").toLowerCase().includes(q) ||
      (t.establishmentName || "").toLowerCase().includes(q) ||
      (t.ownerName || "").toLowerCase().includes(q)
    );
  });

  const onReply = async (ticketId: string) => {
    if (!user) return;
    const text = (drafts[ticketId] || "").trim();
    if (!text) {
      toast({ title: "Réponse requise", variant: "destructive" });
      return;
    }
    try {
      await replySupportTicket(db, ticketId, user.uid, text, "in_progress");
      toast({ title: "Réponse envoyée" });
      setDrafts((d) => ({ ...d, [ticketId]: "" }));
      reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Envoi impossible",
        variant: "destructive",
      });
    }
  };

  const onResolve = async (ticketId: string) => {
    try {
      await updateDoc(doc(supportTicketsColRef(db), ticketId), {
        status: "resolved",
        updatedAt: Date.now(),
      });
      toast({ title: "Ticket marqué résolu" });
      reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Mise à jour impossible",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle size={20} />
          Support utilisateurs ({filtered.length})
        </CardTitle>
        <CardDescription>Répondez directement aux problèmes signalés par les gérants</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun ticket support.</p>
        ) : (
          filtered.map((t) => {
            const wa = (t.whatsapp || "").replace(/\D/g, "");
            return (
              <div key={t.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{t.subject}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.establishmentName || t.ownerName || t.ownerUid}
                      {t.tabletImei ? ` • IMEI ${t.tabletImei}` : ""}
                    </div>
                  </div>
                  <Badge>{t.status}</Badge>
                </div>
                <p className="text-sm">{t.message}</p>
                <p className="text-xs text-muted-foreground">{formatWhen(t.createdAt)}</p>
                {t.adminReply && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <strong>Votre réponse :</strong> {t.adminReply}
                  </div>
                )}
                <Textarea
                  rows={3}
                  placeholder="Répondre à l'utilisateur…"
                  value={drafts[t.id] || ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="nack" onClick={() => onReply(t.id)}>
                    Répondre
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onResolve(t.id)}>
                    Marquer résolu
                  </Button>
                  {wa ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
