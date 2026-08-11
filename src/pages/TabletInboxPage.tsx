import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import NackLogo from "@/components/NackLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useManagerAuth } from "@/hooks/useManagerAuth";
import { db } from "@/lib/firebase";
import { getAssignedTabletImei } from "@/lib/tabletsSupport";
import { listTabletMessagesForImei, markTabletMessageRead } from "@/lib/tabletMessages";
import { unlockTabletFullAccess } from "@/lib/tabletMode";
import type { TabletMessageDoc } from "@/types/tabletMessage";
import { Bell, Download, FileText, Lock, MessageSquare, RefreshCw, Smartphone } from "lucide-react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { tabletMessagesColRef } from "@/lib/collections";

function formatWhen(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return "—";
  }
}

function typeIcon(type: TabletMessageDoc["type"]) {
  if (type === "receipt") return <FileText className="h-5 w-5 text-nack-red" />;
  if (type === "notification") return <Bell className="h-5 w-5 text-amber-600" />;
  return <MessageSquare className="h-5 w-5 text-blue-600" />;
}

const TabletInboxPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [imei, setImei] = useState("");
  const [messages, setMessages] = useState<Array<TabletMessageDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, code, setCode, isChecking, requireManagerAuth, submit, close } = useManagerAuth(profile);

  useEffect(() => {
    setImei(getAssignedTabletImei(profile));
  }, [profile]);

  useEffect(() => {
    if (!user || !imei) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(tabletMessagesColRef(db, imei), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TabletMessageDoc) })));
        setLoading(false);
      },
      () => {
        listTabletMessagesForImei(db, imei).then(setMessages).finally(() => setLoading(false));
      }
    );
    return () => unsub();
  }, [user, imei]);

  const unreadCount = useMemo(
    () => messages.filter((m) => !m.readAt).length,
    [messages]
  );

  const openReceipt = async (msg: TabletMessageDoc & { id: string }) => {
    if (!imei) return;
    try {
      if (!msg.readAt) await markTabletMessageRead(db, imei, msg.id);
      const data = msg.receiptData;
      if (!data || !data.items?.length) {
        alert(msg.body || msg.title);
        return;
      }
      const { printThermalTicket } = await import("@/utils/ticketThermal");
      printThermalTicket({
        orderNumber: data.orderNumber || `ADM-${msg.id.slice(-6)}`,
        establishmentName: data.establishmentName || profile?.establishmentName || "Établissement",
        establishmentLogo: data.establishmentLogo || profile?.logoUrl,
        tableZone: data.tableZone || "Tablette",
        items: data.items,
        total: Number(data.total || 0),
        createdAt: data.createdAt || msg.createdAt,
        companyName: data.companyName || profile?.companyName,
        fullAddress: data.fullAddress || profile?.fullAddress,
        businessPhone: data.businessPhone || profile?.businessPhone || profile?.phone,
        rcsNumber: data.rcsNumber || profile?.rcsNumber,
        nifNumber: data.nifNumber || profile?.nifNumber,
        legalMentions: data.legalMentions || profile?.legalMentions,
        customMessage: data.customMessage || profile?.customMessage,
        ticketLogoUrl: data.ticketLogoUrl || profile?.ticketLogoUrl,
        showDeliveryMention: data.showDeliveryMention ?? profile?.showDeliveryMention,
        showCSSMention: data.showCSSMention ?? profile?.showCSSMention,
        cssPercentage: data.cssPercentage ?? profile?.cssPercentage,
        ticketFooterMessage: data.ticketFooterMessage || profile?.ticketFooterMessage,
      });
    } catch (e) {
      console.error(e);
      alert("Impossible d'ouvrir le reçu.");
    }
  };

  const openMessage = async (msg: TabletMessageDoc & { id: string }) => {
    if (!imei) return;
    if (!msg.readAt) await markTabletMessageRead(db, imei, msg.id).catch(() => undefined);
    if (msg.type === "receipt") {
      await openReceipt(msg);
      return;
    }
    alert(`${msg.title}\n\n${msg.body}`);
  };

  const goFullApp = () => {
    requireManagerAuth(() => {
      unlockTabletFullAccess();
      navigate("/dashboard", { replace: true });
    });
  };

  if (!user) return null;

  if (!imei) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <NackLogo size="lg" showAdminButton={false} />
        <Card className="mt-6 max-w-md w-full border-0 shadow-card">
          <CardHeader>
            <CardTitle>Compte non assigné à une tablette</CardTitle>
            <CardDescription>
              Seuls les établissements auxquels l&apos;administrateur NACK a assigné une tablette (IMEI) peuvent accéder à cette interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-gradient-primary text-white" onClick={() => navigate("/dashboard")}>
              Retour à l&apos;application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Smartphone className="h-6 w-6 text-nack-red shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold truncate">{profile?.establishmentName || "Ma tablette"}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">IMEI {imei}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Badge className="bg-red-600">{unreadCount} nouveau{unreadCount > 1 ? "x" : ""}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goFullApp}>
            <Lock className="h-4 w-4 mr-1" />
            Gérant
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card className="border-0 shadow-card bg-nack-beige-light/50">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Cette tablette affiche uniquement les reçus, messages et notifications envoyés par l&apos;administrateur NACK pour cet IMEI.
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Chargement…</p>
        ) : messages.length === 0 ? (
          <Card className="border-0 shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun document reçu pour le moment.
            </CardContent>
          </Card>
        ) : (
          messages.map((msg) => (
            <Card
              key={msg.id}
              className={`border-0 shadow-card cursor-pointer transition hover:shadow-md ${!msg.readAt ? "ring-2 ring-nack-red/30" : ""}`}
              onClick={() => void openMessage(msg)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {typeIcon(msg.type)}
                    <CardTitle className="text-base truncate">{msg.title}</CardTitle>
                  </div>
                  {!msg.readAt && <Badge variant="secondary">Nouveau</Badge>}
                </div>
                <CardDescription>{formatWhen(msg.createdAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm line-clamp-3">{msg.body}</p>
                {msg.type === "receipt" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-nack-red border-nack-red/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openReceipt(msg);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ouvrir le reçu
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Accès gérant</DialogTitle>
            <DialogDescription>Code requis pour ouvrir l&apos;application complète sur cette tablette.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="tablet-manager-pin">Code gérant</Label>
            <Input
              id="tablet-manager-pin"
              type="password"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
            <Button className="w-full bg-gradient-primary text-white" disabled={isChecking} onClick={() => void submit()}>
              {isChecking ? "Vérification…" : "Déverrouiller"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabletInboxPage;
