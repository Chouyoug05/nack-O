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
        navigate('/dashboard', { replace: true });
      }
    };
    run();
  }, [user, navigate]);

  return null;
};

export default PaymentSuccess; 