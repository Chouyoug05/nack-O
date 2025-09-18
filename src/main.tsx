import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OrderProvider } from "@/contexts/OrderContext";
import "./index.css";
import "./lib/firebase";

createRoot(document.getElementById("root")!).render(
  <OrderProvider>
    <App />
  </OrderProvider>
);
