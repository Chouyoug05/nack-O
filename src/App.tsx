import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { OrderProvider } from "@/contexts/OrderContext";
import { EventProvider } from "@/contexts/EventContext";
import PWAInstallButton from "@/components/PWAInstallButton";
import WhatsAppCommunityPopup from "@/components/WhatsAppCommunityPopup";
import LocationRequestDialog from "@/components/LocationRequestDialog";
import NackLogo from "@/components/NackLogo";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import SubscriptionGate from "@/components/subscription/SubscriptionGate";
import AdminCheck from "./pages/AdminCheck";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { useNotifications } from "@/hooks/useNotifications";
import { useOfflineCacheWarmup } from "@/hooks/useOfflineCacheWarmup";
import OfflineAuthBlock from "@/components/OfflineAuthBlock";
import OfflineStatusBar from "@/components/OfflineStatusBar";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const ConfigureTickets = lazy(() => import("./pages/ConfigureTickets"));
const TeamPage = lazy(() => import("@/components/pages/TeamPage"));
const CustomerDetailsPage = lazy(() => import("@/components/pages/CustomerDetailsPage"));
const ClientDetailsPage = lazy(() => import("./pages/ClientDetailsPage"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const ServeurInterface = lazy(() => import("./pages/ServeurInterface"));
const CaisseInterface = lazy(() => import("./pages/CaisseInterface"));
const CuisineInterface = lazy(() => import("./pages/CuisineInterface"));
const AgentEvenementInterface = lazy(() => import("./pages/AgentEvenementInterface"));
const EventPublicPage = lazy(() => import("./pages/EventPublicPage"));
const PublicOrderingPage = lazy(() => import("./pages/PublicOrderingPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentError = lazy(() => import("./pages/PaymentError"));

const queryClient = new QueryClient();

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <NackLogo size="xl" pulse showAdminButton={false} />
  </div>
);

const LazyBoundary = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<FullscreenLoader />}>{children}</Suspense>
);

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const RequireProfile = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, profileLoading } = useAuth();
  if (profileLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/complete-profile" replace />;
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isAdminLoading } = useAuth();
  if (isAdminLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    // Rediriger vers admin-check pour diagnostic au lieu de dashboard
    return <Navigate to="/admin-check" replace />;
  }
  return <>{children}</>;
};

// Composant pour rediriger automatiquement selon l'état de connexion
const HomeRedirect = () => {
  const { user, profile, loading, profileLoading, isAdmin, isAdminLoading } = useAuth();

  if (loading || profileLoading || isAdminLoading) {
    return <FullscreenLoader />;
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
  const { user } = useAuth();
  useNotifications(user?.uid);
  useOfflineCacheWarmup();
  const location = useLocation();
  const isPublicPage = location.pathname.startsWith('/event/') ||
    location.pathname.startsWith('/commande/') ||
    location.pathname.startsWith('/affiliate') ||
    location.pathname === '/admin-check' ||
    location.pathname === '/mon-uid' ||
    location.pathname === '/register' ||
    location.pathname === '/complete-profile' ||
    location.pathname === '/onboarding' ||
    location.pathname === '/login' ||
    location.pathname === '/configure-tickets';
  return (
    <>
      <OfflineStatusBar />
      <Outlet />
      {!isPublicPage && <PWAInstallButton />}
      {!isPublicPage && <WhatsAppCommunityPopup />}
      {!isPublicPage && <LocationRequestDialog />}
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
      { path: "login", element: <><OfflineAuthBlock title="Connexion indisponible hors‑ligne" /><Login /></> },
      { path: "register", element: <><OfflineAuthBlock title="Inscription indisponible hors‑ligne" /><Register /></> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "complete-profile", element: <LazyBoundary><RequireAuth><CompleteProfile /></RequireAuth></LazyBoundary> },
      { path: "configure-tickets", element: <LazyBoundary><RequireAuth><RequireProfile><ConfigureTickets /></RequireProfile></RequireAuth></LazyBoundary> },
      { path: "dashboard", element: <LazyBoundary><RequireAuth><RequireProfile><SubscriptionGate><Dashboard /></SubscriptionGate></RequireProfile></RequireAuth></LazyBoundary> },
      { path: "team", element: <LazyBoundary><RequireAuth><RequireProfile><SubscriptionGate><FeatureGate feature="team"><TeamPage /></FeatureGate></SubscriptionGate></RequireProfile></RequireAuth></LazyBoundary> },
      { path: "customer/:customerId", element: <LazyBoundary><RequireAuth><RequireProfile><SubscriptionGate><CustomerDetailsPage /></SubscriptionGate></RequireProfile></RequireAuth></LazyBoundary> },
      { path: "admin-check", element: <AdminCheck /> },
      { path: "mon-uid", element: <AdminCheck /> },
      { path: "affiliate", element: <LazyBoundary><AffiliateDashboard /></LazyBoundary> },
      { path: "admin", element: <LazyBoundary><RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth></LazyBoundary> },
      { path: "admin/client/:uid", element: <LazyBoundary><RequireAuth><RequireAdmin><ClientDetailsPage /></RequireAdmin></RequireAuth></LazyBoundary> },
      { path: "serveur/:agentCode", element: <LazyBoundary><ServeurInterface /></LazyBoundary> },
      { path: "caisse/:agentCode", element: <LazyBoundary><CaisseInterface /></LazyBoundary> },
      { path: "cuisine/:agentCode", element: <LazyBoundary><CuisineInterface /></LazyBoundary> },
      { path: "agent-evenement/:agentCode", element: <LazyBoundary><AgentEvenementInterface /></LazyBoundary> },
      { path: "event/:eventId", element: <LazyBoundary><EventPublicPage /></LazyBoundary> },
      { path: "commande/:establishmentId", element: <LazyBoundary><PublicOrderingPage /></LazyBoundary> },
      { path: "payment/success", element: <LazyBoundary><PaymentSuccess /></LazyBoundary> },
      { path: "payment/error", element: <LazyBoundary><PaymentError /></LazyBoundary> },
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
