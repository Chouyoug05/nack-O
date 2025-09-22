import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PaymentError = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [navigate]);
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