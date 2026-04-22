import { useState, useEffect, useRef } from "react";
import { Home, Search, List, Film, Clapperboard, Tv, Bell, User, LogOut, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";

const sidebarItems = [
  { id: "search", icon: Search, label: "Pesquisar", path: null, action: "search" },
  { id: "home", icon: Home, label: "Início", path: "/" },
  { id: "notifications", icon: Bell, label: "Notificações", path: null, action: "notifications" },
  { id: "list", icon: List, label: "Minha Lista", path: "/my-list" },
  { id: "categories", icon: Film, label: "Categorias", path: "/categories" },
  { id: "nostalgia", icon: Clapperboard, label: "Nostalgia", path: "/nostalgia" },
  { id: "live", icon: Tv, label: "24H", path: "/canais24h" },
];

const hiddenPaths = ["/admin", "/login", "/signup", "/watch/", "/watch-local/", "/profiles"];

export const TVSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentProfile, plan, logout } = useAuth();
  const { isLiteMode } = useAppConfig();
  const [expanded, setExpanded] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Detect desktop screens
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const shouldShow = isLiteMode || isDesktop;

  const shouldHide =
    !shouldShow ||
    !user ||
    hiddenPaths.some((p) => location.pathname.startsWith(p));

  // D-pad keyboard navigation
  useEffect(() => {
    if (shouldHide) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when sidebar is focused/expanded
      if (!expanded) {
        if (e.key === "ArrowLeft") {
          setExpanded(true);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          e.preventDefault();
          e.stopPropagation();
          break;
        case "ArrowDown":
          setFocusedIndex((prev) =>
            Math.min(sidebarItems.length + 1, prev + 1)
          ); // +2 for notification & profile
          e.preventDefault();
          e.stopPropagation();
          break;
        case "ArrowRight":
        case "Escape":
          setExpanded(false);
          e.preventDefault();
          e.stopPropagation();
          break;
        case "Enter":
          handleItemSelect(focusedIndex);
          e.preventDefault();
          e.stopPropagation();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [shouldHide, expanded, focusedIndex]);

  const handleItemSelect = (index: number) => {
    const item = allItems[index];
    if (!item) return;

    if (item.path) {
      navigate(item.path);
      setExpanded(false);
    } else if (item.action === "search") {
      // Trigger search dropdown in header
      const searchBtn = document.querySelector('[aria-haspopup="menu"] .lucide-search')?.parentElement;
      if (searchBtn instanceof HTMLElement) {
        searchBtn.click();
      }
      setExpanded(false);
    } else if (item.action === "notifications") {
      // Open notifications
      const bellBtn = document.querySelector('.notification-bell-trigger') as HTMLElement;
      if (bellBtn) {
        bellBtn.click();
      } else {
        // Fallback or alert
        navigate("/profile"); // Example fallback
      }
      setExpanded(false);
    } else if (item.id === "admin") {
      navigate("/admin");
      setExpanded(false);
    } else if (item.id === "profile") {
      navigate("/profile");
      setExpanded(false);
    } else if (item.id === "logout") {
      logout();
      setExpanded(false);
    }
  };

  if (shouldHide) return null;

  const isAdminUser = user?.email === "www.nivaldo.com.ao@gmail.com";

  const allItems = [
    ...sidebarItems.map((item) => ({
      ...item,
      type: "nav" as const,
    })),
    ...(isAdminUser ? [{ id: "admin", icon: Settings, label: "Painel Admin", type: "extra" as const }] : []),
    { id: "profile", icon: User, label: "Perfil", type: "extra" as const },
    { id: "logout", icon: LogOut, label: "Sair", type: "extra" as const },
  ];

  return (
    <>
      {/* Hover trigger zone */}
      <div
        className="tv-sidebar-trigger"
        onMouseEnter={() => setExpanded(true)}
      />

      <nav
        ref={sidebarRef}
        className={`tv-sidebar ${expanded ? "tv-sidebar--expanded" : ""}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo at top */}
        <div className="tv-sidebar-logo">
          <div className="tv-sidebar-logo-icon">
            <Film className="w-5 h-5 text-white" />
          </div>
          {expanded && (
            <span className="tv-sidebar-logo-text">
              Uni<span className="text-primary">Tv</span>Film
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <div className="tv-sidebar-items">
          {allItems.map((item, index) => {
            const isActive =
              item.type === "nav" && "path" in item && item.path
                ? item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path)
                : false;
            const isFocused = expanded && focusedIndex === index;

            return (
              <button
                key={item.id}
                className={`tv-sidebar-item ${isActive ? "tv-sidebar-item--active" : ""} ${isFocused ? "tv-sidebar-item--focused" : ""}`}
                onClick={() => handleItemSelect(index)}
                onFocus={() => setFocusedIndex(index)}
                tabIndex={expanded ? 0 : -1}
              >
                {/* Active indicator bar */}
                {isActive && <span className="tv-sidebar-active-bar" />}

                <item.icon
                  className={`tv-sidebar-item-icon ${isActive ? "tv-sidebar-item-icon--active" : ""}`}
                />

                {expanded && (
                  <span
                    className={`tv-sidebar-item-label ${isActive ? "tv-sidebar-item-label--active" : ""}`}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Profile / Admin / Logout Section at bottom */}
        {expanded && (
          <div className="tv-sidebar-profile">
            <img
              src={
                currentProfile?.avatarUrl ||
                "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
              }
              alt="Profile"
              className="tv-sidebar-profile-avatar"
            />
            <div className="tv-sidebar-profile-info">
              <span className="tv-sidebar-profile-name">
                {currentProfile?.name || "Usuário"}
              </span>
              <span className="tv-sidebar-profile-plan">
                Plano {plan?.name || "Básico"}
              </span>
            </div>
          </div>
        )}
      </nav>

      {/* Overlay when expanded */}
      {expanded && (
        <div
          className="tv-sidebar-overlay"
          onClick={() => setExpanded(false)}
        />
      )}
    </>
  );
};
