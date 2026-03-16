import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Film, Megaphone, CreditCard, ChevronLeft, ChevronRight, Settings, Video, Users, Image, Package, Database, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Conteúdos", path: "/admin", icon: Film },
  { title: "Usuários", path: "/admin/users", icon: Users },
  { title: "Planos", path: "/admin/plans", icon: Package },
  { title: "Avatares", path: "/admin/avatars", icon: Image },
  { title: "Slider Vídeos", path: "/admin/slider", icon: Video },
  { title: "Notificações", path: "/admin/notifications", icon: Megaphone },
  { title: "Anúncios", path: "/admin/ads", icon: Megaphone },
  { title: "Pagamentos", path: "/admin/payments", icon: CreditCard },
  { title: "Sistema", path: "/admin/system", icon: Database },
  { title: "Configurações", path: "/admin/settings", icon: Settings },
];

export const AdminSidebarContent = ({
  collapsed = false,
  onClose,
  showLogo = true
}: {
  collapsed?: boolean;
  onClose?: () => void;
  showLogo?: boolean;
}) => {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      {showLogo && (
        <div className="h-16 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            {!collapsed && <span className="font-bold text-foreground">Admin</span>}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          {!collapsed && <span>Voltar ao Site</span>}
        </NavLink>
      </div>
    </div>
  );
};

export const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border z-40 transition-all duration-300 flex flex-col hidden lg:flex",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="absolute -right-3 top-20 z-50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-full bg-primary text-primary-foreground border-2 border-background shadow-md hover:scale-110 transition-transform"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>
      <AdminSidebarContent collapsed={collapsed} />
    </aside>
  );
};
