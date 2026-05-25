import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, query, where, getDocs, collectionGroup, getDoc } from "firebase/firestore";
import { paymentsColRef } from "@/lib/collections";
import type { PaymentTransaction } from "@/types/payment";

const PaymentError = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [establishmentInfo, setEstablishmentInfo] = useState<{ name: string; logoUrl?: string; id?: string } | null>(null);
  
  useEffect(() => {
    const run = async () => {
      const returnClientElectron = searchParams.get("returnClient") === "electron";
      const scheduleNav = (fn: () => void, ms: number) => {
        if (returnClientElectron) return;
        setTimeout(fn, ms);
      };

      const transactionId = searchParams.get('transactionId');
      const reference = searchParams.get('reference') || '';
      const isMenuDigitalPayment = reference.includes('menu-digital');
      
      if (transactionId) {
        try {
          if (isMenuDigitalPayment) {
            // Pour menu digital, chercher dans toutes les collections
            const paymentsQuery = query(
              collectionGroup(db, 'payments'),
              where('transactionId', '==', transactionId)
            );
            const snapshot = await getDocs(paymentsQuery);
            
            if (!snapshot.empty) {
              const paymentData = snapshot.docs[0].data() as PaymentTransaction;
              
              // Mettre à jour la transaction
              await updateDoc(snapshot.docs[0].ref, {
                status: 'failed',
                updatedAt: Date.now(),
              });
              
              // Charger les infos de l'établissement
              if (paymentData.establishmentId) {
                const profileDoc = await getDoc(doc(db, 'profiles', paymentData.establishmentId));
                if (profileDoc.exists()) {
                  const profileData = profileDoc.data();
                  setEstablishmentInfo({
                    name: profileData.establishmentName || 'Établissement',
                    logoUrl: profileData.logoUrl,
                    id: paymentData.establishmentId,
                  });
                }
              }
              
              // Rediriger vers le menu après 3 secondes
              scheduleNav(() => {
                if (paymentData.establishmentId) {
                  navigate(`/commande/${paymentData.establishmentId}`, { replace: true });
                } else {
                  navigate('/', { replace: true });
                }
              }, 3000);
              return;
            }
          } else if (user) {
            // Pour les autres paiements, nécessite authentification
            const paymentsRef = paymentsColRef(db, user.uid);
            const q = query(paymentsRef, where('transactionId', '==', transactionId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await updateDoc(doc(paymentsRef, snapshot.docs[0].id), {
                status: 'failed',
                updatedAt: Date.now(),
              });
            }
            scheduleNav(() => navigate('/dashboard', { replace: true }), 3000);
            return;
          }
        } catch (error) {
          console.error('Erreur mise à jour transaction failed:', error);
        }
      }
      
      // Redirection par défaut
      if (isMenuDigitalPayment) {
        const establishmentIdFromUrl = searchParams.get('establishmentId');
        const redirectPath = establishmentInfo?.id || establishmentIdFromUrl
          ? `/commande/${establishmentInfo?.id || establishmentIdFromUrl}`
          : '/';
        scheduleNav(() => navigate(redirectPath, { replace: true }), 3000);
      } else {
        const redirectPath = user ? '/dashboard' : '/';
        scheduleNav(() => navigate(redirectPath, { replace: true }), 3000);
      }
    };
    run();
  }, [navigate, user, searchParams, establishmentInfo]);
  
  const reference = searchParams.get('reference') || '';
  const isMenuDigitalPayment = reference.includes('menu-digital');
  const wantsDesktopReturn = searchParams.get("returnClient") === "electron";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full text-center space-y-6 bg-white rounded-2xl shadow-xl p-8">
        {establishmentInfo?.logoUrl && (
          <div className="flex justify-center mb-4">
            <img 
              src={establishmentInfo.logoUrl} 
              alt={establishmentInfo.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-red-500"
            />
          </div>
        )}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isMenuDigitalPayment ? 'Paiement échoué' : 'Paiement non abouti'}
        </h1>
        <p className="text-sm text-gray-600">
          {wantsDesktopReturn
            ? "Le paiement n'a pas abouti. Revenez dans l'application NACK pour réessayer."
            : isMenuDigitalPayment
              ? 'Le paiement de votre commande n\'a pas pu être effectué. Vous pouvez réessayer ou commander sans paiement.'
              : 'Une erreur est survenue lors du paiement. Redirection…'}
        </p>
        {wantsDesktopReturn && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-left space-y-3">
            <p className="text-sm font-medium text-amber-950">Retour à l&apos;application</p>
            <Button asChild className="w-full" size="lg" variant="secondary">
              <a href="nack://open">Ouvrir l&apos;application NACK</a>
            </Button>
          </div>
        )}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-1">💳 Paiement par Airtel Money</p>
          <p className="text-xs">Le paiement est disponible uniquement via <strong>Airtel Money</strong> pour le moment.</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentError; 