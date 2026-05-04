import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { GuestSessionManager } from "@/components/GuestSessionManager";
import { HolidayDecorations } from "@/components/HolidayDecorations";
import FocusNavigator from "@/components/FocusNavigator";
import GlobalContentProtection from "@/components/GlobalContentProtection";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { TVSidebar } from "@/components/TVSidebar";
import { RedirectManager } from "@/components/RedirectManager";
import { useAppConfig } from "@/hooks/useAppConfig";

import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

// Helper to handle lazy loading errors (ChunkLoadError)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  React.lazy(() =>
    componentImport().catch((error) => {
      console.error("Chunk load error detected, reloading page...", error);
      window.location.reload();
      return { default: () => null };
    })
  );

// Pages
const Index = lazyWithRetry(() => import("./pages/Index"));
const HomeWrapper = lazyWithRetry(() => import("./pages/HomeWrapper"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const Signup = lazyWithRetry(() => import("./pages/Signup"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const AdminAds = lazyWithRetry(() => import("./pages/AdminAds"));
const AdminPayments = lazyWithRetry(() => import("./pages/AdminPayments"));
const AdminSettings = lazyWithRetry(() => import("./pages/AdminSettings").then(module => ({ default: module.AdminSettings })));
const AdminSlider = lazyWithRetry(() => import("./pages/AdminSlider"));
const AdminPlans = lazyWithRetry(() => import("./pages/AdminPlans"));
const AdminSystem = lazyWithRetry(() => import("./pages/AdminSystem"));
const AdminNotifications = lazyWithRetry(() => import("./pages/AdminNotifications"));
const Payment = lazyWithRetry(() => import("./pages/Payment"));
const ContentDetails = lazyWithRetry(() => import("./pages/ContentDetails"));
const Player = lazyWithRetry(() => import("./pages/Player"));
const MyList = lazyWithRetry(() => import("./pages/MyList"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ProfileSelection = lazyWithRetry(() => import("./pages/profiles/ProfileSelection"));
const Categories = lazyWithRetry(() => import("./pages/Categories"));
const LiveTV = lazyWithRetry(() => import("./pages/LiveTV"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const NostalgiaTube = lazyWithRetry(() => import("./pages/NostalgiaTube"));
const Canais24h = lazyWithRetry(() => import("./pages/Canais24h"));
const ProviderView = lazyWithRetry(() => import("./pages/ProviderView"));
const VerifyCode = lazyWithRetry(() => import("./pages/VerifyCode"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const About = lazyWithRetry(() => import("./pages/About"));
const TermsOfUse = lazyWithRetry(() => import("./pages/TermsOfUse"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const Transfers = lazyWithRetry(() => import("./pages/Transfers"));
const LocalPlayer = lazyWithRetry(() => import("./pages/LocalPlayer"));
const IPTV = lazyWithRetry(() => import("./pages/IPTV"));

// Lazy load admin components
const Search = lazyWithRetry(() => import("./pages/Search"));
const AdminUsers = lazyWithRetry(() => import("@/components/admin/AdminUsers").then(module => ({ default: module.AdminUsers })));
const AdminAvatars = lazyWithRetry(() => import("@/components/admin/AdminAvatars").then(module => ({ default: module.AdminAvatars })));

import { LoadingScreen } from "@/components/LoadingScreen";
import { NetworkStatus } from "@/components/NetworkStatus";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { AppUpdater } from "@/components/AppUpdater";

// Small component to apply lite-mode body class
const LiteModeBodyClass = () => {
  const mode = (import.meta.env.VITE_APP_MODE as string) || 'standard';
  
  React.useEffect(() => {
    if (typeof window !== 'undefined' && mode === 'lite') {
      const isMobilePhone = /iPhone|Android|Mobile/i.test(navigator.userAgent) && !/TV|SmartTV|GoogleTV|AppleTV|HbbTV|STB/i.test(navigator.userAgent);
      
      if (!isMobilePhone) {
        document.body.classList.add('lite-mode');
      } else {
        document.body.classList.remove('lite-mode');
      }
    }
  }, [mode]);
  
  return null;
};

const SidebarPaddingManager = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  React.useEffect(() => {
    const hiddenPaths = ["/watch/", "/watch-local/", "/login", "/signup", "/profiles", "/nostalgia"];
    let shouldHideSidebar = hiddenPaths.some(path => location.pathname.startsWith(path));
    
    // Also hide if on root path and NOT logged in (Landing page)
    if (location.pathname === '/' && !user) {
      shouldHideSidebar = true;
    }
    
    if (shouldHideSidebar) {
      document.body.classList.add('no-sidebar');
    } else {
      document.body.classList.remove('no-sidebar');
    }
    
    return () => {
      document.body.classList.remove('no-sidebar');
    };
  }, [location.pathname]);
  
  return null;
};

const OrientationManager = () => {
  const mode = (import.meta.env.VITE_APP_MODE as string) || 'standard';
  
  React.useEffect(() => {
    const lockOrientation = async () => {
      if (mode === 'lite' && Capacitor.isNativePlatform()) {
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } catch (e) {
          console.warn('Orientation lock failed:', e);
        }
      }
    };
    
    lockOrientation();
    
    // Cleanup - return to allowing all rotations if unmounted
    return () => {
      if (Capacitor.isNativePlatform()) {
        ScreenOrientation.unlock().catch(() => {});
      }
    };
  }, [mode]);
  
  return null;
};

const App = () => {
  const isElectron = typeof window !== 'undefined' && (window as any).ipcRenderer?.isElectron;
  const Router = isElectron ? HashRouter : BrowserRouter;

  const { isLiteMode } = useAppConfig();
  // Global Fullscreen/StatusBar hide for Capacitor (APK)
  React.useEffect(() => {
    const hideStatusBar = async () => {
      try {
        const { StatusBar } = await import('@capacitor/status-bar');
        if (StatusBar) {
          await StatusBar.hide();
        }
      } catch (e) {
        // StatusBar plugin not available or not on mobile
      }
    };
    
    // @ts-ignore
    if (window.Capacitor?.isNativePlatform) {
      hideStatusBar();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RedirectManager />
          <Toaster />
          <Sonner />
          <Router>
            <SidebarPaddingManager />
            <AppUpdater />
            <PWAInstallBanner />
            <FocusNavigator />
            {!isLiteMode && <HolidayDecorations />}
            <NetworkStatus />
            <OfflineIndicator />
            <GlobalContentProtection />
            <LiteModeBodyClass />
            <OrientationManager />
            <MobileBottomNav />
            <TVSidebar />
            <AuthGuard>
              <GuestSessionManager />
              <ErrorBoundary>
                <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<HomeWrapper />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/ads" element={<AdminAds />} />
                  <Route path="/admin/payments" element={<AdminPayments />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/slider" element={<AdminSlider />} />
                  <Route path="/admin/plans" element={<AdminPlans />} />
                  <Route path="/admin/system" element={<AdminSystem />} />
                  <Route path="/admin/notifications" element={<AdminNotifications />} />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/content/:id" element={<ContentDetails />} />
                  <Route path="/watch/:id" element={<Player />} />
                  <Route path="/my-list" element={<MyList />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profiles" element={<ProfileSelection />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/tv" element={<LiveTV />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/nostalgia" element={<NostalgiaTube />} />
                  <Route path="/nostalgia/:id" element={<NostalgiaTube />} />
                  <Route path="/provider/:providerId" element={<ProviderView />} />
                  <Route path="/canais24h" element={<Canais24h />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/terms" element={<TermsOfUse />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/verify-code" element={<VerifyCode />} />
                  <Route path="/transfers" element={<Transfers />} />
                  <Route path="/watch-local/:id" element={<LocalPlayer />} />
                  <Route path="/iptv" element={<IPTV />} />

                  <Route path="/admin/users" element={
                    <AdminLayout title="Gerenciar Usuários">
                      <AdminUsers />
                    </AdminLayout>
                  } />

                  <Route path="/admin/avatars" element={
                    <AdminLayout title="Gerenciar Avatares">
                      <AdminAvatars />
                    </AdminLayout>
                  } />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </AuthGuard>
          </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;