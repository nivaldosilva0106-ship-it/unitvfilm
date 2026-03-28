import { Home, List, Film, Clapperboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { label: "Início", icon: Home, path: "/" },
  { label: "Minha Lista", icon: List, path: "/my-list" },
  { label: "Categorias", icon: Film, path: "/categories" },
  { label: "Nostalgia", icon: Clapperboard, path: "/nostalgia" },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on admin, login, signup, player pages
  const hiddenPaths = ["/admin", "/login", "/signup", "/watch/", "/profiles"];
  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));
  if (shouldHide) return null;

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const isActive =
          item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`mobile-bottom-nav-item ${isActive ? "active" : ""}`}
          >
            <div className="mobile-bottom-nav-icon-wrapper">
              <item.icon className="mobile-bottom-nav-icon" />
              {isActive && <span className="mobile-bottom-nav-indicator" />}
            </div>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
