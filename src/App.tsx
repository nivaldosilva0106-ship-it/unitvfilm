import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { GuestSessionManager } from "@/components/GuestSessionManager";
import { HolidayDecorations } from "@/components/HolidayDecorations";
import FocusNavigator from "@/components/FocusNavigator";
import GlobalContentProtection from "@/components/GlobalContentProtection";

const queryClient = new QueryClient();

// Lazy load pages
const Index = React.lazy(() => import("./pages/Index"));
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
const NostalgiaTube = React.lazy(() => import("./pages/NostalgiaTube"));
const VerifyCode = React.lazy(() => import("./pages/VerifyCode"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

// Lazy load admin components
const AdminUsers = React.lazy(() => import("@/components/admin/AdminUsers").then(module => ({ default: module.AdminUsers })));
const AdminAvatars = React.lazy(() => import("@/components/admin/AdminAvatars").then(module => ({ default: module.AdminAvatars })));

import { LoadingScreen } from "@/components/LoadingScreen";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <FocusNavigator />
        <HolidayDecorations />

        <BrowserRouter>
          <GlobalContentProtection />
          <AuthGuard>
            <GuestSessionManager />
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
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
                <Route path="/nostalgia" element={<NostalgiaTube />} />
                <Route path="/nostalgia/:id" element={<NostalgiaTube />} />
                <Route path="/verify-code" element={<VerifyCode />} />

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
          </AuthGuard>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;