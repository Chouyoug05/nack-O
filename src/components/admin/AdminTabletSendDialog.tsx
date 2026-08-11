import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { sendTabletMessageFromAdmin } from "@/lib/tabletMessages";
import type { TabletDoc } from "@/lib/tabletsSupport";
import type { TabletMessageType } from "@/types/tabletMessage";
import { Send } from "lucide-react";

type Props = {
  tablet: TabletDoc & { id: string };
};

export function AdminTabletSendDialog({ tablet }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TabletMessageType>("message");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [receiptTotal, setReceiptTotal] = useState("");
  const [receiptLabel, setReceiptLabel] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setType("message");
    setTitle("");
    setBody("");
    setReceiptTotal("");
    setReceiptLabel("");
  };

  const onSend = async () => {
    if (!user) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      let receiptData;
      if (type === "receipt") {
        const total = Number(receiptTotal.replace(/\s/g, "")) || 0;
        const label = receiptLabel.trim() || trimmedTitle;
        receiptData = {
          orderNumber: `ADM-${Date.now().toString().slice(-6)}`,
          establishmentName: tablet.establishmentName || "",
          tableZone: "Tablette",
          items: [{ name: label, quantity: 1, price: total }],
          total,
          createdAt: Date.now(),
        };
      }
      await sendTabletMessageFromAdmin(db, user.uid, tablet, {
        type,
        title: trimmedTitle,
        body: body.trim() || trimmedTitle,
        receiptData,
      });
      toast({
        title: "Envoyé à la tablette",
        description: `IMEI ${tablet.imei || tablet.id} — notification créée pour l'établissement.`,
      });
      setOpen(false);
      reset();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Envoi impossible",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-4 w-4 mr-1" />
          Envoyer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer à la tablette</DialogTitle>
          <DialogDescription>
            {tablet.establishmentName || "Établissement"} — IMEI{" "}
            <span className="font-mono">{tablet.imei || tablet.id}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TabletMessageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="receipt">Reçu</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tablet-msg-title">Titre</Label>
            <Input id="tablet-msg-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reçu du jour" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tablet-msg-body">Message</Label>
            <Textarea id="tablet-msg-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Texte visible sur la tablette…" />
          </div>
          {type === "receipt" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tablet-receipt-label">Libellé du reçu</Label>
                <Input id="tablet-receipt-label" value={receiptLabel} onChange={(e) => setReceiptLabel(e.target.value)} placeholder="Ex: Abonnement mensuel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tablet-receipt-total">Montant (XAF)</Label>
                <Input id="tablet-receipt-total" inputMode="numeric" value={receiptTotal} onChange={(e) => setReceiptTotal(e.target.value)} placeholder="15000" />
              </div>
            </>
          )}
          <Button className="w-full bg-gradient-primary text-white" disabled={sending} onClick={() => void onSend()}>
            {sending ? "Envoi…" : "Envoyer à cette tablette"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
