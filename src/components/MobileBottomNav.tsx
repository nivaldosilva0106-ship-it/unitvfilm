import { useEffect, useState } from "react";
import { Home, List, Film, Clapperboard, Tv } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToMyList, getAllContents } from "@/lib/firebase";

const navItems = [
  { label: "Início", icon: Home, path: "/", type: 'home' },
  { label: "Minha Lista", icon: List, path: "/my-list", type: 'list' },
  { label: "Categorias", icon: Film, path: "/categories", type: 'categories' },
  { label: "Nostalgia", icon: Clapperboard, path: "/nostalgia", type: 'nostalgia' },
  { label: "24H", icon: Tv, path: "/canais24h", type: 'live' },
];

const hiddenPaths = ["/admin", "/login", "/signup", "/watch/", "/profiles"];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProfile } = useAuth();
  
  const [listCount, setListCount] = useState(0);
  const [hasNewHome, setHasNewHome] = useState(false);
  const [hasNewNostalgia, setHasNewNostalgia] = useState(false);
  const [hideNewBadges, setHideNewBadges] = useState(false);

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

  // Data fetching and Badges management
  useEffect(() => {
    let unsubscribeList: (() => void) | undefined;

    const initBadgesData = async () => {
      // 1. New Content Check
      try {
        const contents = await getAllContents();
        setHasNewHome(contents.some(c => c.is_new));
        setHasNewNostalgia(contents.some(c => c.category === 'nostalgia' && c.is_new));
      } catch (err) {
        console.error("Error checking new content:", err);
      }

      // 2. Real-time List Listener
      if (currentProfile) {
        unsubscribeList = subscribeToMyList(currentProfile.id, (items) => {
          setListCount(items.length);
        });
      }
    };

    initBadgesData();

    // 3. 1-Minute Timer for "New" Badges
    const sessionTimerKey = "unitv_new_badges_hidden";
    const isAlreadyHidden = sessionStorage.getItem(sessionTimerKey) === "true";
    
    if (isAlreadyHidden) {
      setHideNewBadges(true);
    } else {
      const timer = setTimeout(() => {
        setHideNewBadges(true);
        sessionStorage.setItem(sessionTimerKey, "true");
      }, 60000); // 1 minute
      return () => clearTimeout(timer);
    }

    return () => {
      if (unsubscribeList) unsubscribeList();
    };
  }, [currentProfile]);

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
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="mobile-bottom-nav-icon-wrapper relative">
              <item.icon className="mobile-bottom-nav-icon" />
              
              {/* ✅ Home Badge: Novo Conteúdo (Disappears in 1 min) */}
              {item.type === 'home' && hasNewHome && !hideNewBadges && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary border border-black/20"></span>
                </span>
              )}

              {/* ✅ Nostalgia Badge: Novo Conteúdo Nostalgia (Disappears in 1 min) */}
              {item.type === 'nostalgia' && hasNewNostalgia && !hideNewBadges && (
                <span className="absolute -top-2 -right-3 px-1 py-0.5 bg-primary text-black text-[7px] font-black rounded-sm animate-bounce shadow-[0_0_8px_rgba(10,255,122,0.4)] leading-none border border-black/10">
                  NOVO
                </span>
              )}

              {/* ✅ My List Badge: Favorites Count */}
              {item.type === 'list' && listCount > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[16px] h-4 flex items-center justify-center bg-red-600 text-white text-[9px] font-bold rounded-full px-1 border border-black shadow-lg">
                  {listCount}
                </span>
              )}

              {/* ✅ 24H Badge: Live Oscillation (Slow) */}
              {item.type === 'live' && (
                <span className="absolute -top-2 -right-3 px-1 py-0.5 bg-red-500 text-white text-[7px] font-black rounded-sm animate-[pulse_3s_infinite] shadow-[0_0_10px_rgba(239,68,68,0.4)] tracking-wider border border-white/10 uppercase">
                  Live
                </span>
              )}

              {isActive && <span className="mobile-bottom-nav-indicator" />}
            </div>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

