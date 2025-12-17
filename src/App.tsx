import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AdminAds from "./pages/AdminAds";
import AdminPayments from "./pages/AdminPayments";
import { AdminSettings } from "./pages/AdminSettings";
import AdminSlider from "./pages/AdminSlider";
import AdminPlans from "./pages/AdminPlans";
import Payment from "./pages/Payment";
import ContentDetails from "./pages/ContentDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyList from "./pages/MyList";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import FocusNavigator from "@/components/FocusNavigator";
import GlobalContentProtection from "@/components/GlobalContentProtection";
import ProfileSelection from "@/pages/profiles/ProfileSelection";
import Categories from "./pages/Categories";
import VerifyCode from "./pages/VerifyCode";

import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminAvatars } from "@/components/admin/AdminAvatars";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <FocusNavigator />


        <BrowserRouter>
          <GlobalContentProtection />
          <AuthGuard>
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
              <Route path="/payment" element={<Payment />} />
              <Route path="/content/:id" element={<ContentDetails />} />
              <Route path="/my-list" element={<MyList />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profiles" element={<ProfileSelection />} />
              <Route path="/categories" element={<Categories />} />
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
          </AuthGuard>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;