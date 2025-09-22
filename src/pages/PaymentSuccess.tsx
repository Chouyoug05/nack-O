import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const PaymentSuccess = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const now = Date.now();
        const thirty = 30 * 24 * 60 * 60 * 1000;
        await updateDoc(doc(db, "profiles", user.uid), {
          plan: 'active',
          subscriptionEndsAt: now + thirty,
          lastPaymentAt: now,
          updatedAt: now,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      }
    };
    run();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Paiement confirmé</h1>
        <p className="text-sm text-muted-foreground">Votre abonnement a été activé. Redirection…</p>
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
          Avertissement: le paiement est disponible uniquement via <strong>Airtel Money</strong>. Moov Money est momentanément indisponible.
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess; 