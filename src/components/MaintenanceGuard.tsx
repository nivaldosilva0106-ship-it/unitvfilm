import React, { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { getSiteSettings } from "@/lib/firebase";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Wrench, ShieldAlert, Hammer } from "lucide-react";

export const MaintenanceGuard = ({ children }: { children: ReactNode }) => {
  const { isAdmin, loading: authLoading } = useAuth();
  const location = useLocation();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(false);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const checkMaintenance = async (isBypass: boolean) => {
      try {
        const settings = await getSiteSettings(isBypass);
        if (active) {
          setMaintenanceEnabled(!!settings.maintenanceModeEnabled);
        }
      } catch (error) {
        console.warn("Failed to load maintenance status:", error);
      } finally {
        if (active) {
          setSettingsLoading(false);
        }
      }
    };

    // Load instantly using cache on mount
    checkMaintenance(false);

    // Also trigger an instant bypass-cache check to get real-time state
    checkMaintenance(true);

    // Poll for real-time maintenance updates every 15 seconds
    const interval = setInterval(() => {
      checkMaintenance(true);
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (authLoading || settingsLoading) {
    return <LoadingScreen />;
  }

  // Paths that are ALWAYS allowed to bypass maintenance mode (so admins can access auth)
  const isAuthOrAdminPath =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname.startsWith("/admin");

  // If maintenance mode is active, block access unless the user is an admin OR accessing an allowed path
  const shouldBlock = maintenanceEnabled && !isAdmin && !isAuthOrAdminPath;

  if (shouldBlock) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 overflow-hidden text-white font-sans">
        {/* Animated ambient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.15),transparent_60%)] animate-pulse" style={{ animationDuration: '8s' }} />
        
        {/* Background grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        {/* Glossy Glassmorphic card */}
        <div className="relative max-w-lg w-full mx-4 p-8 rounded-3xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] text-center transform transition-all duration-300 animate-in fade-in zoom-in-95">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center justify-center w-24 h-24 rounded-full border border-emerald-500/30 bg-black shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <div className="relative">
              <Wrench className="w-10 h-10 text-emerald-400 animate-bounce" style={{ animationDuration: '3s' }} />
              <Hammer className="absolute -bottom-2 -right-2 w-6 h-6 text-emerald-500 animate-pulse" />
            </div>
          </div>

          <h1 className="mt-12 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-emerald-100 to-emerald-400 bg-clip-text text-transparent">
            Sistema em Manutenção
          </h1>
          
          <p className="mt-4 text-zinc-400 leading-relaxed text-sm md:text-base">
            Estamos a realizar melhorias e atualizações importantes para lhe proporcionar a melhor experiência de streaming possível. 
          </p>

          <div className="my-6 p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 flex items-center gap-3 text-left">
            <ShieldAlert className="w-6 h-6 text-emerald-400 shrink-0 animate-pulse" />
            <p className="text-xs text-emerald-300 font-medium">
              Não se preocupe, os seus dados e subscrições estão totalmente seguros. Voltamos muito em breve!
            </p>
          </div>

          <div className="flex flex-col gap-2 items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">UniTVFilm Whitelabel</span>
            <div className="w-12 h-1 rounded-full bg-emerald-500/30" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
