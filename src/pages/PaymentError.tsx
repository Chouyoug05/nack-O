import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
      if (!user) return;
      
      // Marquer la transaction comme échouée si transactionId fourni
      const transactionId = searchParams.get('transactionId');
      if (transactionId) {
        try {
          const paymentsRef = paymentsColRef(db, user.uid);
          const q = query(paymentsRef, where('transactionId', '==', transactionId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            await updateDoc(doc(paymentsRef, snapshot.docs[0].id), {
              status: 'failed',
              updatedAt: Date.now(),
            });
          }
        } catch (error) {
          console.error('Erreur mise à jour transaction failed:', error);
        }
      }
    };
    run();
    
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [navigate, user, searchParams]);
  
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Paiement non abouti</h1>
        <p className="text-sm text-muted-foreground">Une erreur est survenue. Redirection…</p>
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
          Avertissement: le paiement est disponible uniquement via <strong>Airtel Money</strong>. Moov Money est momentanément indisponible.
        </div>
      </div>
    </div>
  );
};

export default PaymentError; 