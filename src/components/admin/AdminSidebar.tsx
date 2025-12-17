import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Film, Megaphone, CreditCard, ChevronLeft, ChevronRight, Settings, Video, Users, Image, Package, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { title: "Conteúdos", path: "/admin", icon: Film },
  { title: "Usuários", path: "/admin/users", icon: Users },
  { title: "Planos", path: "/admin/plans", icon: Package },
  { title: "Avatares", path: "/admin/avatars", icon: Image },
  { title: "Slider Vídeos", path: "/admin/slider", icon: Video },
  { title: "Anúncios", path: "/admin/ads", icon: Megaphone },
  { title: "Pagamentos", path: "/admin/payments", icon: CreditCard },
  { title: "Sistema", path: "/admin/system", icon: Database },
  { title: "Configurações", path: "/admin/settings", icon: Settings },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border z-40 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Admin</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
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
    </aside>
  );
};
