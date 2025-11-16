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
import Payment from "./pages/Payment";
import ContentDetails from "./pages/ContentDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyList from "./pages/MyList";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import FocusNavigator from "@/components/FocusNavigator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <FocusNavigator />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/ads" element={<AdminAds />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/content/:id" element={<ContentDetails />} />
            <Route path="/my-list" element={<MyList />} />
            <Route path="/profile" element={<Profile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;