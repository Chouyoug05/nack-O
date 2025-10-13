import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { productsColRef } from "@/lib/collections";
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

    return () => unsubscribe();
  }, [user, profile, saveProfile]);
};
