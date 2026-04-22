import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar, AdminSidebarContent } from "./AdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Users, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToUserStats, type UserStats } from "@/lib/firebase";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, online: 0, offline: 0 });

  useEffect(() => {
    const unsubscribe = subscribeToUserStats(setStats);
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col min-h-screen relative">
        <header className="h-16 border-b border-white/5 bg-card/50 backdrop-blur-sm flex items-center gap-4 px-2 lg:px-4 sticky top-0 z-30">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-border bg-card">
              <AdminSidebarContent showLogo={true} />
            </SheetContent>
          </Sheet>

          <h1 className="text-xl font-bold truncate">{title}</h1>
          
          <div className="ml-auto flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar whitespace-nowrap py-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] sm:text-xs font-bold text-blue-500">{stats.active} Ativos</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse">
              <Wifi className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[10px] sm:text-xs font-bold text-green-500">{stats.online} Online</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/10 border border-gray-500/20 rounded-full">
              <WifiOff className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] sm:text-xs font-bold text-gray-400">{stats.offline} Offline</span>
            </div>
          </div>
        </header>
        <main className="overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
