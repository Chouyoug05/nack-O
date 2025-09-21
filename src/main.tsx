import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OrderProvider } from "@/contexts/OrderContext";
import "./index.css";
import "./lib/firebase";
import ErrorBoundary from "@/components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <OrderProvider>
      <App />
    </OrderProvider>
  </ErrorBoundary>
);
