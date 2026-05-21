import { useState, useEffect, useRef } from "react";
import { Home, Search, List, Film, Clapperboard, Tv, Bell, User, LogOut, Settings, Heart, Clock, MonitorPlay, LayoutGrid } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getAllContents, getMyList } from "@/lib/firebase";
import { getDatabase, ref, onValue } from "firebase/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { NotificationDropdown } from "./notifications/NotificationDropdown";

const sidebarItems = [
  { id: "search", icon: Search, label: "Pesquisar", path: "/search" },
  { id: "home", icon: Home, label: "Início", path: "/" },
  { id: "categories", icon: LayoutGrid, label: "Categorias", path: "/categories" },
  { id: "notifications", icon: Bell, label: "Notificações", path: "/notifications" },
  { id: "list", icon: List, label: "Minha Lista", path: "/my-list" },
  { id: "nostalgia", icon: Clapperboard, label: "Nostalgia", path: "/nostalgia" },
  { id: "live", icon: Tv, label: "TV Online", path: "/tv" },
  { id: "canais24h", icon: Clock, label: "Canais 24h", path: "/canais24h" },
  { id: "iptv", icon: MonitorPlay, label: "Gerar IPTV", path: "/iptv" },
  { id: "profile", icon: User, label: "Perfil", path: "/profile" },
  { id: "admin", icon: Settings, label: "Painel Admin", path: "/admin" },
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
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Detect desktop screens
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Detect mobile phone (not tablet or TV)
  const isMobilePhone = /iPhone|Android|Mobile/i.test(navigator.userAgent) && !/TV|SmartTV|GoogleTV|AppleTV|HbbTV|STB/i.test(navigator.userAgent);
  const shouldShow = (isLiteMode && !isMobilePhone) || isDesktop;

  const shouldHide =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/update-password" ||
    location.pathname === "/confirm-email" ||
    location.pathname.startsWith("/watch/") ||
    location.pathname.startsWith("/watch-local/") ||
    location.pathname === "/profiles" ||
    location.pathname === "/nostalgia" ||
    !shouldShow ||
    !user;

  // D-pad keyboard navigation
  useEffect(() => {
    if (shouldHide || !expanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          e.preventDefault();
          e.stopPropagation();
          break;
        case "ArrowDown":
          setFocusedIndex((prev) =>
            Math.min(allItems.length - 1, prev + 1)
          ); 
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

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [myListCount, setMyListCount] = useState(0);
  const [newContentCount, setNewContentCount] = useState<Record<string, number>>({});

  // Fetch notifications count
  useEffect(() => {
    if (!user) return;
    const db = getDatabase();
    const pRef = ref(db, `notifications/${user.uid}`);
    const gRef = ref(db, `globalNotifications`);
    const rRef = ref(db, `profiles/${user.uid}/readGlobalNotifications`);

    const handles = { p: [] as any[], g: [] as any[], r: {} as any };
    const calculate = () => {
      const pUnread = handles.p.filter(i => !i.isRead).length;
      const gUnread = handles.g.filter(i => !handles.r[i.id]).length;
      setUnreadNotifications(pUnread + gUnread);
    };

    const u1 = onValue(pRef, s => { handles.p = Object.values(s.val() || {}); calculate(); });
    const u2 = onValue(gRef, s => { handles.g = Object.values(s.val() || {}); calculate(); });
    const u3 = onValue(rRef, s => { handles.r = s.val() || {}; calculate(); });

    return () => { u1(); u2(); u3(); };
  }, [user]);

  // Fetch My List count (Real-time)
  useEffect(() => {
    if (!user) return;
    const db = getDatabase();
    const listRef = ref(db, `myList/${user.uid}`);
    
    const unsubscribe = onValue(listRef, (snapshot) => {
      if (snapshot.exists()) {
        const items = Object.values(snapshot.val());
        setMyListCount(items.length);
      } else {
        setMyListCount(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch new content badges
  useEffect(() => {
    const loadNewContent = async () => {
      try {
        const allContent = await getAllContents();
        const now = new Date();
        const counts: Record<string, number> = { home: 0, nostalgia: 0, live: 0, canais24h: 0 };
        
        allContent.forEach(content => {
          if (content.new_since) {
            const addedDate = new Date(content.new_since);
            const diffHours = (now.getTime() - addedDate.getTime()) / (1000 * 60 * 60);
            
            if (diffHours <= 24) {
              counts.home++;
              if (content.category === 'nostalgia') counts.nostalgia++;
              if (content.category === 'tv') counts.live++;
              if (content.category === 'canais24h') counts.canais24h++;
            }
          } else if (content.is_new) {
             counts.home++;
             if (content.category === 'nostalgia') counts.nostalgia++;
             if (content.category === 'tv') counts.live++;
             if (content.category === 'canais24h') counts.canais24h++;
          }
        });
        setNewContentCount(counts);
      } catch (e) {}
    };
    loadNewContent();
  }, [location.pathname]);

  const handleItemSelect = (index: number) => {
    const item = allItems[index];
    if (!item) return;

    if (item.path) {
      navigate(item.path);
      setExpanded(false);
    } else if (item.id === "admin") {
      navigate("/admin");
      setExpanded(false);
    } else if (item.id === "profile") {
      navigate("/profile");
      setExpanded(false);
    }
  };

  if (shouldHide) return null;

  const isAdminUser = user?.email === "www.nivaldo.com.ao@gmail.com";

  const allItems = sidebarItems.filter(item => {
    if (item.id === "admin") return isAdminUser;
    return true;
  }).map(item => {
    let badge = 0;
    if (item.id === "notifications") badge = unreadNotifications;
    if (item.id === "list") badge = myListCount;
    if (item.id === "home") badge = newContentCount.home || 0;
    if (item.id === "nostalgia") badge = newContentCount.nostalgia || 0;
    if (item.id === "live") badge = newContentCount.live || 0;
    if (item.id === "canais24h") badge = newContentCount.canais24h || 0;

    return { ...item, badge };
  });

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
        </div>

        {/* Navigation Items */}
        <div className="tv-sidebar-items">
          {allItems.map((item, index) => {
            const isActive = item.path
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

                <div className="relative">
                  <item.icon
                    className={`tv-sidebar-item-icon ${isActive ? "tv-sidebar-item-icon--active" : ""}`}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border border-background animate-in zoom-in duration-300">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>

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
          <div 
            className="tv-sidebar-profile cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => {
              navigate('/profile');
              setExpanded(false);
            }}
          >
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
