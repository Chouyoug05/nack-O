import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  createSupportTicket,
  getRememberedTabletImei,
  listSupportTicketsByOwner,
  listTabletsByOwner,
  registerTablet,
  type SupportTicketDoc,
  type TabletDoc,
} from "@/lib/tabletsSupport";

function formatWhen(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return "—";
  }
}

export function TabletsSettingsPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [imei, setImei] = useState("");
  const [label, setLabel] = useState("Tablette principale");
  const [tablets, setTablets] = useState<Array<TabletDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!user) return;
    const docs = await listTabletsByOwner(db, user.uid);
    setTablets(docs);
  };

  useEffect(() => {
    if (!user) return;
    setImei(getRememberedTabletImei(user.uid));
    reload().catch(() => undefined);
  }, [user]);

  const onSave = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      await registerTablet(db, user.uid, profile, imei, label);
      toast({ title: "Tablette enregistrée", description: "L'IMEI est enregistré pour le suivi technique." });
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Enregistrement impossible",
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
            <Smartphone size={20} className="text-nack-red" />
            Enregistrer une tablette
          </CardTitle>
          <CardDescription>
            Saisissez l&apos;IMEI de la tablette pour permettre à l&apos;administrateur NACK de la retracer en cas de problème.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tablet-imei">IMEI (14-15 chiffres)</Label>
            <Input
              id="tablet-imei"
              inputMode="numeric"
              maxLength={15}
              className="font-mono"
              placeholder="356789012345678"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tablet-label">Nom de la tablette</Label>
            <Input
              id="tablet-label"
              placeholder="Ex: Tablette caisse"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button variant="nack" className="w-full" disabled={loading} onClick={onSave}>
            {loading ? "Enregistrement…" : "Enregistrer cette tablette"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Mes tablettes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tablets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tablette enregistrée.</p>
          ) : (
            tablets.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 space-y-1">
                <div className="font-semibold">{t.label || "Tablette"}</div>
                <div className="text-sm text-muted-foreground font-mono">IMEI : {t.imei || t.id}</div>
                <div className="text-xs text-muted-foreground">
                  Dernière activité : {formatWhen(t.lastSeenAt)} • {t.status || "active"}
                </div>
              </div>
            ))
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
  const [tablets, setTablets] = useState<Array<TabletDoc & { id: string }>>([]);
  const [tickets, setTickets] = useState<Array<SupportTicketDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!user) return;
    const [tabDocs, ticketDocs] = await Promise.all([
      listTabletsByOwner(db, user.uid),
      listSupportTicketsByOwner(db, user.uid),
    ]);
    setTablets(tabDocs);
    setTickets(ticketDocs);
  };

  useEffect(() => {
    reload().catch(() => undefined);
  }, [user]);

  const onSend = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      await createSupportTicket(db, user.uid, profile, { subject, message, tabletImei });
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
          <div className="space-y-2">
            <Label>Tablette concernée</Label>
            <Select value={tabletImei || "__none__"} onValueChange={(v) => setTabletImei(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une tablette" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucune / non liée</SelectItem>
                {tablets.map((t) => (
                  <SelectItem key={t.id} value={t.imei || t.id}>
                    {(t.label || "Tablette") + " (" + (t.imei || t.id) + ")"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
