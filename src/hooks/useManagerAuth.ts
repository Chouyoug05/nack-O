import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { sha256Hex } from "@/lib/sha256";
import type { UserProfile } from "@/types/profile";

const AUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = "nack_manager_auth_until";

/**
 * Hook centralisé de vérification gérant (PIN code).
 *
 * Regroupe toute la logique autrefois dupliquée entre StockPage et EventsPage :
 * - état d'ouverture de la modale
 * - code saisi
 * - fenêtre de validité de 10 minutes (partagée via sessionStorage)
 * - action différée à exécuter après validation
 * - soumission + hash SHA-256 + comparaison au managerPinHash
 *
 * Les pages parentes appellent simplement `requireManagerAuth(action)` sans gérer
 * aucun state d'authentification.
 */
export function useManagerAuth(profile: UserProfile | null) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  // Lecture initiale du sessionStorage (fenêtre partagée entre les pages)
  const [authValidUntil, setAuthValidUntil] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? Number(raw) : 0;
    } catch { return 0; }
  });

  /**
   * Fonction déclencheuse appelée par les pages.
   * - Pas de code gérant configuré → exécute l'action immédiatement
   * - Fenêtre de 10 min encore valide → exécute l'action immédiatement
   * - Sinon → ouvre la modale et stocke l'action en attente
   */
  const requireManagerAuth = useCallback((action: () => void) => {
    if (!profile?.managerPinHash) { action(); return; }
    if (Date.now() < authValidUntil) { action(); return; }
    pendingAction.current = action;
    setCode("");
    setIsOpen(true);
  }, [profile?.managerPinHash, authValidUntil]);

  const submit = useCallback(async () => {
    if (!profile?.managerPinHash) {
      setIsOpen(false);
      const fn = pendingAction.current; pendingAction.current = null; if (fn) fn();
      return;
    }
    if (!code) {
      toast({ title: "Code requis", description: "Veuillez saisir votre code gérant.", variant: "destructive" });
      return;
    }
    setIsChecking(true);
    try {
      const hash = await sha256Hex(code);
      if (hash !== profile.managerPinHash) throw new Error("bad");
      const until = Date.now() + AUTH_WINDOW_MS;
      setAuthValidUntil(until);
      try { sessionStorage.setItem(STORAGE_KEY, String(until)); } catch { /* ignore */ }
      setIsOpen(false);
      const fn = pendingAction.current; pendingAction.current = null; if (fn) fn();
      toast({ title: "Vérification réussie", description: "Action autorisée pendant 10 minutes." });
    } catch {
      toast({ title: "Code incorrect", description: "Le code gérant ne correspond pas.", variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  }, [code, profile?.managerPinHash, toast]);

  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    code,
    setCode,
    isChecking,
    requireManagerAuth,
    submit,
    close,
  };
}
