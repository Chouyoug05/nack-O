import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OrderProvider } from "@/contexts/OrderContext";
import "./index.css";
import "./lib/firebase";
// import ErrorBoundary from "@/components/ErrorBoundary";

// Canonical redirect (www -> apex) pour stabiliser l’auth Google
(() => {
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.toLowerCase().startsWith('www.')) {
        const target = window.location.href.replace(/^https?:\/\/www\./i, (m) => m.replace('www.', ''));
        window.location.replace(target);
      }
    }
  } catch {
    // ignore
  }
})();

createRoot(document.getElementById("root")!).render(
  // <ErrorBoundary>
    <OrderProvider>
      <App />
    </OrderProvider>
  // </ErrorBoundary>
);
