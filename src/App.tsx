import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { OrderProvider } from "@/contexts/OrderContext";
import { EventProvider } from "@/contexts/EventContext";
import PWAInstallButton from "@/components/PWAInstallButton";
import WhatsAppCommunityPopup from "@/components/WhatsAppCommunityPopup";
import LocationRequestDialog from "@/components/LocationRequestDialog";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import ServeurInterface from "./pages/ServeurInterface";
import CaisseInterface from "./pages/CaisseInterface";
import EventPublicPage from "./pages/EventPublicPage";
import AgentEvenementInterface from "./pages/AgentEvenementInterface";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import CompleteProfile from "./pages/CompleteProfile";
import SubscriptionGate from "@/components/subscription/SubscriptionGate";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentError from "./pages/PaymentError";
import AdminDashboard from "./pages/AdminDashboard";
import PublicOrderingPage from "./pages/PublicOrderingPage";
import TeamPage from "@/components/pages/TeamPage";

const queryClient = new QueryClient();

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-sm text-muted-foreground">Chargement…</div>
  </div>
);

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader/>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const RequireProfile = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, profileLoading } = useAuth();
  if (profileLoading) return <FullscreenLoader/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/complete-profile" replace />;
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isAdminLoading } = useAuth();
  if (isAdminLoading) return <FullscreenLoader/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Composant pour rediriger automatiquement selon l'état de connexion
const HomeRedirect = () => {
  const { user, profile, loading, profileLoading, isAdmin, isAdminLoading } = useAuth();
  
  if (loading || profileLoading || isAdminLoading) {
    return <FullscreenLoader/>;
  }
  
  if (user && (isAdmin || profile)) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }
  
  if (user && !profile && !isAdmin) {
    return <Navigate to="/complete-profile" replace />;
  }
  
  return <Onboarding />;
};

const RootLayout = () => {
  const location = useLocation();
  return (
    <>
      <Outlet />
      {!location.pathname.startsWith('/event/') && <PWAInstallButton />}
      <WhatsAppCommunityPopup />
      <LocationRequestDialog />
    </>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "onboarding", element: <Onboarding /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "complete-profile", element: <RequireAuth><CompleteProfile /></RequireAuth> },
      { path: "dashboard", element: <RequireAuth><RequireProfile><SubscriptionGate><Dashboard /></SubscriptionGate></RequireProfile></RequireAuth> },
      { path: "team", element: <RequireAuth><RequireProfile><SubscriptionGate><TeamPage /></SubscriptionGate></RequireProfile></RequireAuth> },
      { path: "admin", element: <RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth> },
      { path: "serveur/:agentCode", element: <ServeurInterface /> },
      { path: "caisse/:agentCode", element: <CaisseInterface /> },
      { path: "agent-evenement/:agentCode", element: <AgentEvenementInterface /> },
      { path: "event/:eventId", element: <EventPublicPage /> },
      { path: "commande/:establishmentId", element: <PublicOrderingPage /> },
      { path: "payment/success", element: <RequireAuth><PaymentSuccess /></RequireAuth> },
      { path: "payment/error", element: <RequireAuth><PaymentError /></RequireAuth> },
      { path: "*", element: <NotFound /> },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
      <EventProvider>
        <OrderProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </OrderProvider>
      </EventProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
