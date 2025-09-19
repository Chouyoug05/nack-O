import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PaymentError = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/settings', { replace: true });
  }, [navigate]);
  return null;
};

export default PaymentError; 