import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createHashRouter, RouterProvider, Outlet, useLocation, Navigate, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Suspense, useEffect, type ReactNode } from "react";
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
import { isElectronRenderer } from "@/lib/platform";
import { isProfileComplete } from "@/utils/profileComplete";
import { lazyWithReload, isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/lazyWithReload";

const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const AdminDashboard = lazyWithReload(() => import("./pages/AdminDashboard"));
const CompleteProfile = lazyWithReload(() => import("./pages/CompleteProfile"));
const ConfigureTickets = lazyWithReload(() => import("./pages/ConfigureTickets"));
const TeamPage = lazyWithReload(() => import("@/components/pages/TeamPage"));
const CustomerDetailsPage = lazyWithReload(() => import("@/components/pages/CustomerDetailsPage"));
const ClientDetailsPage = lazyWithReload(() => import("./pages/ClientDetailsPage"));
const AffiliateDashboard = lazyWithReload(() => import("./pages/AffiliateDashboard"));
const ServeurInterface = lazyWithReload(() => import("./pages/ServeurInterface"));
const CaisseInterface = lazyWithReload(() => import("./pages/CaisseInterface"));
const CuisineInterface = lazyWithReload(() => import("./pages/CuisineInterface"));
const AgentEvenementInterface = lazyWithReload(() => import("./pages/AgentEvenementInterface"));
const EventPublicPage = lazyWithReload(() => import("./pages/EventPublicPage"));
const PublicOrderingPage = lazyWithReload(() => import("./pages/PublicOrderingPage"));
const PaymentSuccess = lazyWithReload(() => import("./pages/PaymentSuccess"));
const PaymentError = lazyWithReload(() => import("./pages/PaymentError"));

const queryClient = new QueryClient();

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <NackLogo size="xl" pulse showAdminButton={false} />
  </div>
);

const LazyBoundary = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<FullscreenLoader />}>{children}</Suspense>
);

/** Catch React Router « Unexpected Application Error » (chunks post-déploiement). */
const RouteErrorFallback = () => {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : String(error || "");

  useEffect(() => {
    if (isChunkLoadError(error) || isChunkLoadError(message)) {
      reloadOnceForStaleChunk();
    }
  }, [error, message]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <NackLogo size="lg" showAdminButton={false} />
      <p className="text-sm text-muted-foreground max-w-md">
        Une mise à jour de l’application est disponible. Rechargez la page.
      </p>
      <button
        type="button"
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
        onClick={() => window.location.reload()}
      >
        Recharger
      </button>
    </div>
  );
};

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const RequireProfile = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, profileLoading } = useAuth();
  if (profileLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isProfileComplete(profile)) return <Navigate to="/complete-profile" replace />;
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

  if (user && (isAdmin || isProfileComplete(profile))) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  if (user && !isProfileComplete(profile) && !isAdmin) {
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

const routes = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "onboarding", element: <Onboarding /> },
      { path: "login", element: <><OfflineAuthBlock title="Connexion requise" /><Login /></> },
      { path: "register", element: <><OfflineAuthBlock title="Inscription requise" /><Register /></> },
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
];

const routerFactory = isElectronRenderer() ? createHashRouter : createBrowserRouter;
const routerBaseName = isElectronRenderer() ? undefined : import.meta.env.BASE_URL;

const router = routerFactory(routes, {
  basename: routerBaseName,
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
