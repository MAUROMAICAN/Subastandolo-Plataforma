import { lazy, Suspense, useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SiteProvider, useSiteSettings } from "@/hooks/useSiteSettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Helmet } from "react-helmet-async";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import CookieConsent from "@/components/CookieConsent";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const DealerApply = lazy(() => import("./pages/DealerApply"));
const DealerDashboard = lazy(() => import("./pages/DealerDashboard"));
const BadgeDemo = lazy(() => import("./pages/BadgeDemo"));
const DisputeCenter = lazy(() => import("./pages/DisputeCenter"));
const BuyerPanel = lazy(() => import("./pages/BuyerPanel"));
const Help = lazy(() => import("./pages/Help"));
const PublicationPolicies = lazy(() => import("./pages/PublicationPolicies"));
const BuyerFAQ = lazy(() => import("./pages/BuyerFAQ"));
const DealerPayments = lazy(() => import("./pages/DealerPayments"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorks"));
const AboutPage = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const TermsPage = lazy(() => import("./pages/Terms"));
const PrivacyPage = lazy(() => import("./pages/Privacy"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Menu = lazy(() => import("./pages/Menu"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const QuieroVender = lazy(() => import("./pages/QuieroVender"));
const DealerProfile = lazy(() => import("./pages/DealerProfile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
    <p className="text-sm text-muted-foreground">Cargando...</p>
  </div>
);

/** Initializes push notification registration */
function PushNotificationInitializer() {
  usePushNotifications();
  return null;
}

/** Initializes real-time UI/audio notifications globally */
function RealtimeNotificationInitializer() {
  useRealtimeNotifications();
  return null;
}

/** Injects dynamic Global Settings into HTML Head */
const SiteHead = () => {
  const { getSetting } = useSiteSettings();
  const faviconUrl = getSetting("favicon_url", "/favicon.ico");

  return (
    <Helmet>
      <link rel="icon" type="image/svg+xml" href={faviconUrl} />
      <link rel="icon" type="image/png" href={faviconUrl} />
      <link rel="apple-touch-icon" href={faviconUrl} />
    </Helmet>
  );
};

const RootRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null; // Or a simple loader
  if (Capacitor.isNativePlatform() && !user) {
    return <Auth />;
  }
  return <Index />;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <ThemeProvider defaultTheme="system" enableSystem attribute="class">
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <AuthProvider>
                  <SiteProvider>
                    <SiteHead />
                    <PushNotificationInitializer />
                    <RealtimeNotificationInitializer />
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<RootRoute />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/home" element={<Index />} />
                        <Route path="/auction/:id" element={<AuctionDetail />} />
                        <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute>} />
                        <Route path="/dealer/apply" element={<ProtectedRoute authOnly><DealerApply /></ProtectedRoute>} />
                        <Route path="/dealer" element={<ProtectedRoute requiredRole="dealer"><DealerDashboard /></ProtectedRoute>} />
                        <Route path="/dealer/:id" element={<DealerProfile />} />
                        <Route path="/demo/badges" element={<BadgeDemo />} />
                        <Route path="/disputes" element={<ProtectedRoute authOnly><DisputeCenter /></ProtectedRoute>} />
                        <Route path="/mi-panel" element={<ProtectedRoute authOnly><BuyerPanel /></ProtectedRoute>} />
                        <Route path="/ayuda" element={<Help />} />
                        <Route path="/politicas-publicacion" element={<PublicationPolicies />} />
                        <Route path="/compradores" element={<BuyerFAQ />} />
                        <Route path="/admin/dealer-payments" element={<ProtectedRoute requiredRole="admin"><DealerPayments /></ProtectedRoute>} />
                        <Route path="/instalar" element={<InstallApp />} />
                        <Route path="/como-funciona" element={<HowItWorksPage />} />
                        <Route path="/nosotros" element={<AboutPage />} />
                        <Route path="/contacto" element={<Contact />} />
                        <Route path="/terminos" element={<TermsPage />} />
                        <Route path="/privacidad" element={<PrivacyPage />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/menu" element={<ProtectedRoute authOnly><Menu /></ProtectedRoute>} />
                        <Route path="/notificaciones" element={<ProtectedRoute authOnly><NotificationsPage /></ProtectedRoute>} />
                        <Route path="/quiero-vender" element={<QuieroVender />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                    <CookieConsent />
                  </SiteProvider>
                </AuthProvider>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ThemeProvider>
  );
};

export default App;
