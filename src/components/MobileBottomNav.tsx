import { useEffect } from "react";
import { Home, List, Film, Clapperboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { label: "Início", icon: Home, path: "/" },
  { label: "Minha Lista", icon: List, path: "/my-list" },
  { label: "Categorias", icon: Film, path: "/categories" },
  { label: "Nostalgia", icon: Clapperboard, path: "/nostalgia" },
];

const hiddenPaths = ["/admin", "/login", "/signup", "/watch/", "/profiles"];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (shouldHide) {
      document.body.style.paddingBottom = "0px";
    } else {
      document.body.style.paddingBottom = "72px";
    }
    return () => {
      document.body.style.paddingBottom = "0px";
    };
  }, [shouldHide]);

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

