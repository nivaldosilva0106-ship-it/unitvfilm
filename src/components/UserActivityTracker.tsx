import React, { useEffect, useRef } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserActivity, getAllContents } from "@/lib/firebase";

export const UserActivityTracker = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Track session start time locally for this visitor session
  const sessionStartRef = useRef<string>(new Date().toISOString());

  // Determine device type
  const getDeviceType = (): string => {
    if (typeof window === "undefined") return "Desconhecido";
    const ua = window.navigator.userAgent.toLowerCase();
    
    // Check if running on Android TV or TV Box based on user agent / performance mode
    const isTV = ua.includes("smart-tv") || 
                 ua.includes("smarttv") || 
                 ua.includes("googletv") || 
                 ua.includes("appletv") || 
                 ua.includes("hbbtv") || 
                 ua.includes("netcast") || 
                 ua.includes("webos") || 
                 ua.includes("tizen") || 
                 ua.includes("firetv") || 
                 ua.includes("mibox") || 
                 ua.includes("tv box") || 
                 ua.includes("tvbox") || 
                 ua.includes("aftb") || 
                 ua.includes("afts") || 
                 ua.includes("roku") || 
                 ua.includes("playstation") || 
                 ua.includes("xbox");

    if (isTV) return "TV / TV Box";
    
    // Mobile check
    const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sphone|palm/i.test(ua);
    if (isMobile) return "Celular";
    
    return "Computador";
  };

  const getFriendlyPageName = (pathname: string): string => {
    if (pathname === "/") return "Página Inicial";
    if (pathname === "/login") return "Página de Login";
    if (pathname === "/signup") return "Página de Cadastro";
    if (pathname === "/search") return "Pesquisa de Conteúdo";
    if (pathname === "/my-list") return "Minha Lista";
    if (pathname === "/profile") return "Configurações de Perfil";
    if (pathname === "/profiles") return "Tela de Perfis";
    if (pathname === "/categories") return "Explorar Categorias";
    if (pathname === "/tv") return "TV ao Vivo";
    if (pathname === "/iptv") return "Gerador de IPTV";
    if (pathname === "/transfers") return "Minhas Transferências";
    if (pathname === "/about") return "Sobre Nós";
    if (pathname === "/terms") return "Termos de Uso";
    if (pathname === "/privacy") return "Políticas de Privacidade";
    if (pathname === "/verify-code") return "Verificação de Conta";
    if (pathname === "/canais24h") return "Transmissão 24h";
    
    // Admin routes
    if (pathname === "/admin") return "Admin: Início";
    if (pathname === "/admin/users") return "Admin: Usuários";
    if (pathname === "/admin/ads") return "Admin: Anúncios";
    if (pathname === "/admin/payments") return "Admin: Pagamentos";
    if (pathname === "/admin/settings") return "Admin: Configurações";
    if (pathname === "/admin/slider") return "Admin: Slider Hero";
    if (pathname === "/admin/plans") return "Admin: Planos";
    if (pathname === "/admin/system") return "Admin: Sistema";
    if (pathname === "/admin/notifications") return "Admin: Notificações";
    if (pathname === "/admin/avatars") return "Admin: Avatares";

    // Player paths (will be replaced by active content name anyway, but fallback is nice)
    if (pathname.startsWith("/watch-local/")) return "Assistindo Player Local";
    if (pathname.startsWith("/watch/")) return "Assistindo Conteúdo";
    if (pathname.startsWith("/nostalgia/")) return "Nostalgia Tube";
    if (pathname.startsWith("/content/")) return "Detalhes do Conteúdo";
    if (pathname.startsWith("/provider/")) return "Provedor de Streaming";

    return pathname;
  };

  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let updateTimeout: NodeJS.Timeout;

    const trackActivity = async () => {
      try {
        const pathname = location.pathname;
        let friendlyPage = getFriendlyPageName(pathname);
        let currentWatchingId: string | null = null;
        let currentWatchingTitle: string | null = null;

        // Check if user is inside a watch or content details page
        const watchMatch = pathname.match(/\/(watch|watch-local|content|nostalgia)\/([^/]+)/);
        if (watchMatch) {
          const type = watchMatch[1];
          const contentId = watchMatch[2];
          currentWatchingId = contentId;

          // Find the content title dynamically
          try {
            const allContents = await getAllContents();
            const content = allContents.find(c => c.id === contentId);
            if (content) {
              let title = content.title;
              
              // Append season/episode if active
              const season = searchParams.get("season");
              const episode = searchParams.get("episode");
              if (season && episode) {
                title += ` - T${season}E${episode}`;
              }
              
              currentWatchingTitle = title;
              
              if (type === "watch" || type === "watch-local" || type === "nostalgia") {
                friendlyPage = `Assistindo: ${title}`;
              } else {
                friendlyPage = `Detalhes de: ${title}`;
              }
            } else {
              currentWatchingTitle = "Conteúdo Desconhecido";
            }
          } catch (err) {
            console.error("Error fetching content details for activity tracker:", err);
          }
        }

        if (!isMounted) return;

        // Save activity state to profiles
        await updateUserActivity(user.uid, {
          currentPage: friendlyPage,
          currentWatchingId,
          currentWatchingTitle,
          sessionStartAt: sessionStartRef.current,
          deviceType: getDeviceType()
        });
      } catch (err) {
        console.warn("[UniTvFilm] Error updating user activity:", err);
      }
    };

    // Debounce slightly to avoid rapid database writes on fast navigation
    updateTimeout = setTimeout(trackActivity, 500);

    // Heartbeat every 30 seconds to keep session active
    const heartbeatInterval = setInterval(trackActivity, 30000);

    return () => {
      isMounted = false;
      clearTimeout(updateTimeout);
      clearInterval(heartbeatInterval);
    };
  }, [location.pathname, searchParams, user?.uid]);

  return null;
};
