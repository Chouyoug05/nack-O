import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrderCancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, refundRequired: boolean) => void;
  orderNumber: string;
  orderTotal: number;
  orderStatus: string;
  paymentMethod?: string;
  isLoading?: boolean;
}

export const OrderCancelDialog = ({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  orderTotal,
  orderStatus,
  paymentMethod,
  isLoading = false
}: OrderCancelDialogProps) => {
  const [reason, setReason] = useState("");
  const [refundRequired, setRefundRequired] = useState(false);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Réinitialiser le formulaire quand le dialog s'ouvre
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setRefundRequired(false);
      setError("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    // Validation : raison obligatoire, min 5 caractères
    if (!reason.trim() || reason.trim().length < 5) {
      setError("La raison d'annulation est obligatoire et doit contenir au moins 5 caractères.");
      return;
    }

    // Si paiement non-cash, proposer remboursement
    const shouldRefund = paymentMethod && paymentMethod !== 'cash' ? refundRequired : false;
    
    onConfirm(reason.trim(), shouldRefund);
  };

  const handleClose = () => {
    if (!isMountedRef.current) return;
    
    // Utiliser requestAnimationFrame pour éviter les problèmes de timing avec React DOM
    requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      setReason("");
      setRefundRequired(false);
      setError("");
      // Petit délai supplémentaire pour laisser React terminer ses mises à jour
      setTimeout(() => {
        if (isMountedRef.current) {
          onClose();
        }
      }, 0);
    });
  };

  const isNonCashPayment = paymentMethod && paymentMethod !== 'cash';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Annuler la commande #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Veuillez fournir une raison d'annulation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {orderStatus === 'sent' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cette commande a été validée. L'annulation nécessitera peut-être un remboursement.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              Raison d'annulation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Ex: Client a changé d'avis, erreur de commande, produit indisponible..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              rows={4}
              className={error ? "border-destructive" : ""}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimum 5 caractères requis
            </p>
          </div>

          {isNonCashPayment && (
            <div className="flex items-start space-x-2 rounded-md border p-4">
              <Checkbox
                id="refund"
                checked={refundRequired}
                onCheckedChange={(checked) => setRefundRequired(checked === true)}
              />
              <div className="space-y-1 leading-none">
                <label
                  htmlFor="refund"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Demander un remboursement
                </label>
                <p className="text-xs text-muted-foreground">
                  Le paiement a été effectué par {paymentMethod === 'mobile' ? 'Mobile Money' : 'Carte'}. 
                  Un remboursement sera nécessaire (montant: {orderTotal.toLocaleString('fr-FR')} XAF).
                </p>
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted p-3">
            <p className="text-sm">
              <strong>Montant de la commande :</strong> {orderTotal.toLocaleString('fr-FR')} XAF
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Statut actuel : {orderStatus === 'pending' ? 'En attente' : orderStatus === 'sent' ? 'Validée' : orderStatus}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Annulation en cours..." : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

