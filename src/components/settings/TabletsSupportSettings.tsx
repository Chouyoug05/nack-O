import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { getAssignedTabletImei } from "@/lib/tabletsSupport";

export function TabletsSettingsPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [assignedImei, setAssignedImei] = useState("");

  useEffect(() => {
    setAssignedImei(getAssignedTabletImei(profile));
  }, [profile]);

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone size={20} className="text-nack-red" />
            Tablette assignée
          </CardTitle>
          <CardDescription>
            L&apos;assignation IMEI est effectuée par l&apos;administrateur NACK depuis Paramètres admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedImei ? (
            <>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{profile?.assignedTabletLabel || "Tablette NACK"}</span>
                  <Badge className="bg-nack-red/10 text-nack-red border-nack-red/20">Assignée par NACK</Badge>
                </div>
                <div className="text-sm font-mono text-muted-foreground">IMEI : {assignedImei}</div>
                <p className="text-sm text-muted-foreground">
                  Ce compte reçoit les reçus, messages et notifications envoyés par l&apos;administrateur pour cette tablette.
                </p>
              </div>
              <Button variant="nack" className="w-full" onClick={() => navigate("/tablet-inbox")}>
                Ouvrir la boîte tablette
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune tablette assignée à ce compte. Contactez l&apos;administrateur NACK pour qu&apos;il enregistre l&apos;IMEI de votre appareil.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SupportSettingsPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tabletImei, setTabletImei] = useState("");
  const [tickets, setTickets] = useState<Array<import("@/lib/tabletsSupport").SupportTicketDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);

  const assignedImei = getAssignedTabletImei(profile);

  const reload = async () => {
    if (!user) return;
    const ticketDocs = await import("@/lib/tabletsSupport").then((m) =>
      m.listSupportTicketsByOwner(db, user.uid)
    );
    setTickets(ticketDocs);
  };

  useEffect(() => {
    reload().catch(() => undefined);
  }, [user]);

  const onSend = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const { createSupportTicket } = await import("@/lib/tabletsSupport");
      await createSupportTicket(db, user.uid, profile, {
        subject,
        message,
        tabletImei: tabletImei || assignedImei,
      });
      toast({ title: "Ticket envoyé", description: "L'administrateur NACK vous répondra bientôt." });
      setSubject("");
      setMessage("");
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Envoi impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle size={20} className="text-nack-red" />
            Contacter le support
          </CardTitle>
          <CardDescription>
            Décrivez votre problème. L&apos;administrateur peut vous répondre directement depuis le tableau de bord admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-subject">Sujet</Label>
            <Input
              id="support-subject"
              placeholder="Ex: Tablette ne démarre plus"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          {assignedImei && (
            <p className="text-sm text-muted-foreground">
              Tablette assignée : <span className="font-mono">{assignedImei}</span>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              rows={5}
              placeholder="Décrivez le problème en détail…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button variant="nack" className="w-full" disabled={loading} onClick={onSend}>
            {loading ? "Envoi…" : "Envoyer au support"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Mes demandes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ticket support.</p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{t.subject}</div>
                  <Badge variant="secondary">{t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.message}</p>
                <p className="text-xs text-muted-foreground">{formatWhen(t.createdAt)}</p>
                {t.adminReply ? (
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm">
                    <strong>Réponse admin :</strong> {t.adminReply}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">En attente de réponse administrateur</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatWhen(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return "—";
  }
}
