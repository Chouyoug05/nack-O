import { useState } from "react";
import { useManagerAuth } from "@/hooks/useManagerAuth";
import { useAuth } from "@/contexts/AuthContext";
import LegacyModal from "@/components/ui/LegacyModal";
import DialogErrorBoundary from "@/components/DialogErrorBoundary";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

interface ManagerAuthDialogProps {
  /** Titre personnalisé (défaut: "Vérification du gérant") */
  title?: string;
  /** Description personnalisée */
  description?: string;
  /** Affiche le toggle Eye/EyeOff pour montrer/masquer le code (défaut: false) */
  showToggle?: boolean;
  /** Classes CSS supplémentaires sur le conteneur */
  className?: string;
}

/**
 * Modale de vérification gérant, unifiée entre StockPage et EventsPage.
 *
 * - Logique (état, sessionStorage, submit) centralisée dans useManagerAuth.
 * - Sur navigateurs hérités (iPad 3 / iOS 9) : rendu via LegacyModal (div HTML pur)
 *   avec des éléments natifs <input> / <button> — sans Radix UI, sans animations,
 *   sans focus trap.
 * - Sur navigateurs modernes : rendu via Dialog Radix avec les composants shadcn.
 * - Toujours enveloppée dans DialogErrorBoundary pour ne jamais bloquer l'interface.
 */
export default function ManagerAuthDialog({
  title = "Vérification du gérant",
  description = "Saisissez votre code gérant pour autoriser cette action.",
  showToggle = false,
  className,
}: ManagerAuthDialogProps) {
  const { profile } = useAuth();
  const { isOpen, code, setCode, isChecking, submit, close } = useManagerAuth(profile);
  const [showPin, setShowPin] = useState(false);

  const isLegacy = typeof window !== "undefined" && (window as any).__NACK_LEGACY_BROWSER__ === true;

  // --- Branche legacy : HTML pur (div + input + button natifs) ---
  if (isLegacy) {
    return (
      <LegacyModal open={isOpen} onClose={close} className={className}>
        <DialogErrorBoundary onClose={close}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem", paddingRight: "1.5rem" }}>
            {title}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem", lineHeight: 1.5 }}>{description}</p>

          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label htmlFor="mgr-code" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Code gérant
              </label>
              <input
                id="mgr-code"
                type={showToggle && showPin ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Saisissez votre code..."
                autoFocus
                disabled={isChecking}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "0.5rem 0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  background: "#fff",
                  color: "#111",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={close}
                disabled={isChecking}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                  opacity: isChecking ? 0.5 : 1,
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isChecking || !code}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #dc2626",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: isChecking || !code ? 0.5 : 1,
                }}
              >
                {isChecking ? "Vérification…" : "Vérifier"}
              </button>
            </div>
          </form>
        </DialogErrorBoundary>
      </LegacyModal>
    );
  }

  // --- Branche modern : Radix Dialog ---
  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className={`sm:max-w-[420px] ${className ?? ""}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-nack-red" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogErrorBoundary onClose={close}>
          <div style={{ marginBottom: "1rem" }}>
            <Label htmlFor="mgr-code">Code gérant</Label>
            <div style={{ position: "relative", marginTop: "0.25rem" }}>
              <Input
                id="mgr-code"
                type={showToggle && showPin ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="Saisissez votre code..."
                autoFocus
                disabled={isChecking}
                style={{ paddingRight: showToggle ? "2.5rem" : undefined }}
              />
              {showToggle && (
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#666",
                    padding: "0.25rem",
                  }}
                  aria-label={showPin ? "Masquer le code" : "Afficher le code"}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button variant="outline" onClick={close} disabled={isChecking}>Annuler</Button>
            <Button onClick={submit} disabled={isChecking || !code} className="bg-nack-red text-white">
              {isChecking ? "Vérification…" : "Vérifier"}
            </Button>
          </div>
        </DialogErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
