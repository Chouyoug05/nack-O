import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { productsColRef, salesColRef } from "@/lib/collections";
import { onSnapshot, query, limit } from "firebase/firestore";

// Hook pour détecter l'ajout du premier produit et mettre à jour le tutoriel
export const useTutorialProgress = () => {
  const { user, profile, saveProfile } = useAuth();

  useEffect(() => {
    if (!user || !profile || profile.tutorialCompleted) return;

    // Écouter les produits pour détecter le premier ajout
    const q = query(productsColRef(db, user.uid), limit(1));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.size > 0 && profile.tutorialStep === 'stock') {
        // Premier produit ajouté, passer à l'étape suivante
        try {
          await saveProfile({
            establishmentName: profile.establishmentName,
            establishmentType: profile.establishmentType,
            ownerName: profile.ownerName,
            email: profile.email,
            phone: profile.phone,
            whatsapp: profile.whatsapp,
            logoUrl: profile.logoUrl,
            tutorialStep: 'first-product',
          });
        } catch (error) {
          console.error('Erreur lors de la mise à jour du tutoriel:', error);
        }
      }
    }, (error) => {
      console.error('Erreur lors de l\'écoute des produits:', error);
    });

    const unsubscribers: Array<() => void> = [unsubscribe];

    // Avancer à l'étape 'sales' si une vente est créée
    const qSales = query(salesColRef(db, user.uid), limit(1));
    const unsubSales = onSnapshot(qSales, async (snapshot) => {
      if (snapshot.size > 0 && (profile.tutorialStep === 'first-product' || profile.tutorialStep === 'stock')) {
        try {
          await saveProfile({
            establishmentName: profile.establishmentName,
            establishmentType: profile.establishmentType,
            ownerName: profile.ownerName,
            email: profile.email,
            phone: profile.phone,
            whatsapp: profile.whatsapp,
            logoUrl: profile.logoUrl,
            tutorialStep: 'sales',
          });
          // Déclencher le popup communauté après l'étape stock
          setTimeout(() => {
            try {
              window.dispatchEvent(new CustomEvent('nack:community:open'));
            } catch {}
          }, 1000);
        } catch (error) {
          console.error('Erreur progression ventes:', error);
        }
      }
    });
    unsubscribers.push(unsubSales);

    // Écouter le téléchargement de rapport pour passer à 'report' puis 'security'
    const onReportDownloaded = async () => {
      if (profile.tutorialStep === 'sales' || profile.tutorialStep === 'report') {
        try {
          await saveProfile({
            establishmentName: profile.establishmentName,
            establishmentType: profile.establishmentType,
            ownerName: profile.ownerName,
            email: profile.email,
            phone: profile.phone,
            whatsapp: profile.whatsapp,
            logoUrl: profile.logoUrl,
            tutorialStep: 'report',
          });
        } catch (error) {
          console.error('Erreur progression rapport:', error);
        }
      }
    };
    window.addEventListener('nack:report:downloaded', onReportDownloaded as EventListener);

    return () => {
      try { unsubscribers.forEach(u => u()); } catch {}
      window.removeEventListener('nack:report:downloaded', onReportDownloaded as EventListener);
    };
  }, [user, profile, saveProfile]);
};
