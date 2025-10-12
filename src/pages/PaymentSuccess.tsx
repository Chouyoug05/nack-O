import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc } from "firebase/firestore";
import { notificationsColRef } from "@/lib/collections";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";

const PaymentSuccess = () => {
  const { user, profile } = useAuth();
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

        // Notification de paiement réussi
        try {
          await addDoc(notificationsColRef(db, user.uid), {
            title: "Paiement réussi",
            message: "Votre abonnement (2 500 XAF) est activé pour 30 jours.",
            type: "success",
            createdAt: now,
            read: false,
          });
        } catch {/* ignore */}

        // Générer le reçu si le profil est disponible
        try {
          if (profile) {
            await generateSubscriptionReceiptPDF({
              establishmentName: profile.establishmentName,
              email: profile.email,
              phone: profile.phone,
              logoUrl: profile.logoUrl,
              uid: user.uid,
            }, {
              amountXaf: 2500,
              paidAt: now,
              paymentMethod: "Airtel Money",
              reference: "abonnement",
            });
          }
        } catch {/* ignore receipt generation errors */}
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      }
    };
    run();
  }, [user, profile, navigate]);

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