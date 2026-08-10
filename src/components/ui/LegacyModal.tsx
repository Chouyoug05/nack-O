import React, { useEffect } from "react";

interface LegacyModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal ultra-léger basé sur un simple <div> + CSS position:fixed.
 *
 * Remplace le Dialog de Radix UI sur les navigateurs hérités (iPad 3 / iOS 9) :
 * - PAS de portail (rendu direct dans le DOM React)
 * - PAS de FocusScope / piège à focus
 * - PAS d'animations / transitions
 * - PAS d'aria-hidden sur le reste du DOM
 *
 * Fermeture : clic sur l'overlay, bouton ×, ou touche Échap.
 */
export default function LegacyModal({ open, onClose, children, className }: LegacyModalProps) {
  // Fermeture par Échap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay — clic sur l'overlay (pas le contenu) = fermer */}
      <div
        className="legacy-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      {/* Contenu */}
      <div
        className={`legacy-modal-content ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="legacy-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>
        {children}
      </div>
    </>
  );
}
