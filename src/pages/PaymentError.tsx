import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { paymentsColRef } from "@/lib/collections";

const PaymentError = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const run = async () => {
      const returnClientElectron = searchParams.get("returnClient") === "electron";
      const scheduleNav = (fn: () => void, ms: number) => {
        if (returnClientElectron) return;
        setTimeout(fn, ms);
      };

      const transactionId = searchParams.get('transactionId');
      const reference = searchParams.get('reference') || '';
      
      if (transactionId) {
        try {
          if (user) {
            // Pour les paiements, nécessite authentification
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
      const redirectPath = user ? '/dashboard' : '/';
      scheduleNav(() => navigate(redirectPath, { replace: true }), 3000);
    };
    run();
  }, [navigate, user, searchParams]);
  
  const wantsDesktopReturn = searchParams.get("returnClient") === "electron";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full text-center space-y-6 bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Paiement non abouti
        </h1>
        <p className="text-sm text-gray-600">
          {wantsDesktopReturn
            ? "Le paiement n'a pas abouti. Revenez dans l'application NACK pour réessayer."
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
          <p className="font-semibold mb-1">💳 Paiement par SingPay</p>
          <p className="text-xs">Le paiement est traité par SingPay : Airtel Money, Moov Money, etc.</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentError; 