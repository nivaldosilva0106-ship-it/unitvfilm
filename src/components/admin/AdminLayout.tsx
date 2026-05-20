import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar, AdminSidebarContent } from "./AdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Users, Wifi, WifiOff, Tv, Laptop, Smartphone, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToUserStats, subscribeToOnlineUsers, type UserStats } from "@/lib/firebase";
import { type UserProfile } from "@/types/user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, online: 0, offline: 0 });
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribeStats = subscribeToUserStats(setStats);
    const unsubscribeOnline = subscribeToOnlineUsers(setOnlineUsers);
    
    document.body.classList.add('admin-mode');
    
    return () => {
      unsubscribeStats();
      unsubscribeOnline();
      document.body.classList.remove('admin-mode');
    };
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
            <button 
              onClick={() => setIsOnlineModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse hover:bg-green-500/20 transition-colors cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[10px] sm:text-xs font-bold text-green-500">{stats.online} Online</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/10 border border-gray-500/20 rounded-full">
              <WifiOff className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] sm:text-xs font-bold text-gray-400">{stats.offline} Offline</span>
            </div>
          </div>
        </header>
        <main className="overflow-x-hidden">
          {children}
        </main>

        <Dialog open={isOnlineModalOpen} onOpenChange={setIsOnlineModalOpen}>
          <DialogContent className="sm:max-w-[450px] bg-[#1a1a1a] border-white/10 text-white rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-green-500" />
                </div>
                Usuários Online
                <span className="ml-auto bg-green-500/10 text-green-500 text-xs px-2 py-1 rounded-full font-bold">
                  {onlineUsers.length}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-6 pt-2 space-y-3">
              {onlineUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum usuário online no momento.</p>
                </div>
              ) : (
                onlineUsers.map((user) => {
                  const getDeviceIcon = (device?: string) => {
                    if (!device) return <Laptop className="w-3.5 h-3.5 text-blue-400" />;
                    const d = device.toLowerCase();
                    if (d.includes("tv")) return <Tv className="w-3.5 h-3.5 text-amber-400" />;
                    if (d.includes("celular") || d.includes("mobile") || d.includes("phone")) return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
                    return <Laptop className="w-3.5 h-3.5 text-blue-400" />;
                  };

                  const getSessionDuration = (sessionStart?: string) => {
                    if (!sessionStart) return null;
                    try {
                      const start = new Date(sessionStart);
                      const diffMs = new Date().getTime() - start.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      if (diffMins < 1) return "Entrou agora";
                      if (diffMins < 60) return `Ativo há ${diffMins} min`;
                      const diffHours = Math.floor(diffMins / 60);
                      return `Ativo há ${diffHours}h ${diffMins % 60}m`;
                    } catch (e) {
                      return null;
                    }
                  };

                  return (
                    <div key={user.id} className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-11 h-11 border-2 border-white/10 group-hover:border-green-500/30 transition-colors">
                          <AvatarImage src={user.currentProfileAvatar || user.photoURL} alt={user.currentProfileName || user.name || user.email} />
                          <AvatarFallback className="bg-green-500/20 text-green-500 font-bold">
                            {(user.currentProfileName || user.name || user.email || 'U').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate group-hover:text-green-400 transition-colors">
                              {user.currentProfileName || user.name || 'Usuário sem nome'}
                            </p>
                            {user.isPremium && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90">
                                VIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
                        </div>
                      </div>

                      {/* User Activity status row */}
                      <div className="mt-1 pt-2 border-t border-white/5 flex flex-col gap-1.5 text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium text-xs text-zinc-200 truncate">
                            {user.currentPage || "Navegando no site"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                          <div className="flex items-center gap-1">
                            {getDeviceIcon(user.deviceType)}
                            <span>{user.deviceType || "Computador"}</span>
                          </div>
                          {user.sessionStartAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              <span>{getSessionDuration(user.sessionStartAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
