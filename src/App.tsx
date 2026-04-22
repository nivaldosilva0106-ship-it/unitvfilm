import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { GuestSessionManager } from "@/components/GuestSessionManager";
import { HolidayDecorations } from "@/components/HolidayDecorations";
import FocusNavigator from "@/components/FocusNavigator";
import GlobalContentProtection from "@/components/GlobalContentProtection";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { TVSidebar } from "@/components/TVSidebar";
import { RedirectManager } from "@/components/RedirectManager";

import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

// Lazy load pages
const Index = React.lazy(() => import("./pages/Index"));
const HomeWrapper = React.lazy(() => import("./pages/HomeWrapper"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const Admin = React.lazy(() => import("./pages/Admin"));
const AdminAds = React.lazy(() => import("./pages/AdminAds"));
const AdminPayments = React.lazy(() => import("./pages/AdminPayments"));
const AdminSettings = React.lazy(() => import("./pages/AdminSettings").then(module => ({ default: module.AdminSettings })));
const AdminSlider = React.lazy(() => import("./pages/AdminSlider"));
const AdminPlans = React.lazy(() => import("./pages/AdminPlans"));
const AdminSystem = React.lazy(() => import("./pages/AdminSystem"));
const AdminNotifications = React.lazy(() => import("./pages/AdminNotifications"));
const Payment = React.lazy(() => import("./pages/Payment"));
const ContentDetails = React.lazy(() => import("./pages/ContentDetails"));
const Player = React.lazy(() => import("./pages/Player"));
const MyList = React.lazy(() => import("./pages/MyList"));
const Profile = React.lazy(() => import("./pages/Profile"));
const ProfileSelection = React.lazy(() => import("./pages/profiles/ProfileSelection"));
const Categories = React.lazy(() => import("./pages/Categories"));
const LiveTV = React.lazy(() => import("./pages/LiveTV"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const NostalgiaTube = React.lazy(() => import("./pages/NostalgiaTube"));
const Canais24h = React.lazy(() => import("./pages/Canais24h"));
const ProviderView = React.lazy(() => import("./pages/ProviderView"));
const VerifyCode = React.lazy(() => import("./pages/VerifyCode"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const About = React.lazy(() => import("./pages/About").catch(() => {
  window.location.reload();
  return { default: () => null };
}));
const TermsOfUse = React.lazy(() => import("./pages/TermsOfUse"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const Transfers = React.lazy(() => import("./pages/Transfers"));
const LocalPlayer = React.lazy(() => import("./pages/LocalPlayer"));

// Lazy load admin components
const Search = React.lazy(() => import("./pages/Search"));
const AdminUsers = React.lazy(() => import("@/components/admin/AdminUsers").then(module => ({ default: module.AdminUsers })));
const AdminAvatars = React.lazy(() => import("@/components/admin/AdminAvatars").then(module => ({ default: module.AdminAvatars })));

import { LoadingScreen } from "@/components/LoadingScreen";
import { NetworkStatus } from "@/components/NetworkStatus";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { AppUpdater } from "@/components/AppUpdater";

// Small component to apply lite-mode body class
const LiteModeBodyClass = () => {
  const mode = (import.meta.env.VITE_APP_MODE as string) || 'standard';
  if (typeof window !== 'undefined' && mode === 'lite') {
    document.body.classList.add('lite-mode');
  }
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <RedirectManager />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppUpdater />
          <PWAInstallBanner />
          <FocusNavigator />
          <HolidayDecorations />
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;