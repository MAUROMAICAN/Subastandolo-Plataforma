import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
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
import ScrollRestoration from "@/components/ScrollRestoration";
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
const MarketplaceHome = lazy(() => import("./pages/MarketplaceHome"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CheckoutTienda = lazy(() => import("./pages/CheckoutTienda"));
const MiCompra = lazy(() => import("./pages/MiCompra"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const DealerStorePage = lazy(() => import("./pages/DealerStorePage"));
const ProhibitedItems = lazy(() => import("./pages/ProhibitedItems"));
const BuyerGuarantee = lazy(() => import("./pages/BuyerGuarantee"));
const LiveLobby = lazy(() => import("./pages/LiveLobby"));
const LiveRoom = lazy(() => import("./pages/LiveRoom"));

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

import { StatusBar, Style } from '@capacitor/status-bar';

/** Initializes native status bar safely */
function NativeStatusBarInitializer() {
  useEffect(() => {
    const initStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setBackgroundColor({ color: '#00000000' });
        } catch (e) {
          console.error("StatusBar config error:", e);
        }
      }
    };
    initStatusBar();
  }, []);
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

/** Branded 3-second loading screen shown after login */
const PostLoginSplash = ({ onDone }: { onDone: () => void }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onDone, 500);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-5"
      style={{
        backgroundColor: "#161625",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 500ms ease",
      }}
    >
      {/* Green S icon */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4700 5520" className="w-20 h-20">
        <polygon
          points="4648.9,3778.18 4590.46,2787.19 2866.32,1811.17 4698.23,1077.87 4208.95,0 1303.42,1122.83 1358.33,2324.26 2878.11,3198.66 0,4366.86 104.01,5512.86"
          fill="#B5FB05"
        />
      </svg>
      <div className="flex flex-col items-center gap-3">
        <p className="text-white text-base font-semibold tracking-wide">Cargando tu panel…</p>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#B5FB05] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-[#B5FB05] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-[#B5FB05] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
};

const RootRoute = () => {
  const { user, loading } = useAuth();
  const [showPostSplash, setShowPostSplash] = useState(false);
  const isFirstMount = useRef(true);
  const prevUserId = useRef<string | null>(null);

  const handlePostSplashDone = useCallback(() => {
    setShowPostSplash(false);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (isFirstMount.current) {
      // First time auth resolves — skip post-login splash
      // (the initial SplashScreen already covered this wait)
      isFirstMount.current = false;
      prevUserId.current = user?.id ?? null;
      return;
    }

    // User just logged in (was null, now has a user)
    if (user && prevUserId.current === null) {
      prevUserId.current = user.id;
      setShowPostSplash(true);
    } else if (!user) {
      prevUserId.current = null;
      setShowPostSplash(false);
    }
  }, [user, loading]);

  if (loading) return null;
  if (Capacitor.isNativePlatform() && !user) {
    return <Auth />;
  }

  // Show post-login splash only after an actual login action
  if (showPostSplash) {
    return <PostLoginSplash onDone={handlePostSplashDone} />;
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
                <ScrollRestoration />
                <AuthProvider>
                  <SiteProvider>
                    <SiteHead />
                    <NativeStatusBarInitializer />
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
                        <Route path="/tienda-vendedor/:id" element={<DealerStorePage />} />
                        <Route path="/tienda" element={<MarketplaceHome />} />
                        <Route path="/producto/:id" element={<ProductDetail />} />
                        <Route path="/checkout-tienda/:productId" element={<ProtectedRoute authOnly><CheckoutTienda /></ProtectedRoute>} />
                        <Route path="/demo/badges" element={<BadgeDemo />} />
                        <Route path="/mi-compra/:id" element={<ProtectedRoute authOnly><MiCompra /></ProtectedRoute>} />
                        <Route path="/disputes" element={<ProtectedRoute authOnly><DisputeCenter /></ProtectedRoute>} />
                        <Route path="/mi-panel" element={<ProtectedRoute authOnly><BuyerPanel /></ProtectedRoute>} />
                        <Route path="/ayuda" element={<Help />} />
                        <Route path="/politicas-publicacion" element={<PublicationPolicies />} />
                        <Route path="/articulos-prohibidos" element={<ProhibitedItems />} />
                        <Route path="/garantia-subastandolo" element={<BuyerGuarantee />} />
                        <Route path="/live" element={<LiveLobby />} />
                        <Route path="/live/:eventId" element={<LiveRoom />} />
                        <Route path="/compradores" element={<BuyerFAQ />} />
                        <Route path="/admin/dealer-payments" element={<ProtectedRoute requiredRole="admin"><DealerPayments /></ProtectedRoute>} />

                        <Route path="/como-funciona" element={<HowItWorksPage />} />
                        <Route path="/nosotros" element={<AboutPage />} />
                        <Route path="/contacto" element={<Contact />} />
                        <Route path="/terminos" element={<TermsPage />} />
                        <Route path="/privacidad" element={<PrivacyPage />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/menu" element={<ProtectedRoute authOnly><Menu /></ProtectedRoute>} />
                        <Route path="/notificaciones" element={<ProtectedRoute authOnly><NotificationsPage /></ProtectedRoute>} />
                        <Route path="/quiero-vender" element={<QuieroVender />} />
                        <Route path="/eliminar-cuenta" element={<DeleteAccount />} />
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
