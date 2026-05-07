import { Film, Search, User, LogOut, List, Settings, Home, Download, ChevronDown, Clapperboard, Tv, Menu, FileText, MonitorPlay, LayoutGrid } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAllContents, checkPlanExpiryNotification } from "@/lib/firebase";
import { NotificationBell } from "./notifications/NotificationBell";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { toast } from "sonner";
import type { Content } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { InstallAppButton } from '@/components/InstallAppButton';
import { useAppConfig } from "@/hooks/useAppConfig";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

export const Header = () => {
  const navigate = useNavigate();
  const { user, profile, plan, isAdmin, logout, currentProfile } = useAuth();
  const { enableBackdropBlur, isLiteMode } = useAppConfig();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop for sidebar layout
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // hasSidebar = true when sidebar is visible (lite mode OR desktop)
  const isMobilePhone = /iPhone|Android|Mobile/i.test(navigator.userAgent) && !/TV|SmartTV|GoogleTV|AppleTV|HbbTV|STB/i.test(navigator.userAgent);
  
  // Sidebar is hidden on these paths
  const hiddenPaths = ["/watch/", "/watch-local/", "/login", "/signup", "/profiles", "/nostalgia"];
  const isSidebarHiddenOnPage = hiddenPaths.some(path => location.pathname.startsWith(path));

  const hasSidebar = ((isLiteMode && !isMobilePhone) || isDesktop) && !isSidebarHiddenOnPage;

  // PWA install
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Controla a visibilidade do botão de instalação (se suportado ou se for iOS)
  const [installButtonVisible, setInstallButtonVisible] = useState(false);

  const isIOS = () => {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  };

  const isStandalone = () => {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
  };

  useEffect(() => {
    const checkInstalled = () => {
      const installed = isStandalone();
      setIsInstalled(installed);
      // O botão de instalação deve ser visível se não estiver instalado E se for iOS OU se o prompt estiver disponível.
      setInstallButtonVisible(!installed && (isIOS() || !!deferredPrompt));
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      checkInstalled(); // Re-check visibility after prompt is set
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setInstallButtonVisible(false);
      toast.success("Aplicativo instalado com sucesso!");
    });

    checkInstalled();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, [deferredPrompt]);

  // Check Expiry on Mount
  useEffect(() => {
    if (user?.uid) {
      checkPlanExpiryNotification(user.uid);
    }
  }, [user]);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast.success("Instalação iniciada");
        } else {
          toast.info("Instalação cancelada");
        }
        setDeferredPrompt(null);
      } catch (e) {
        console.error("Erro ao chamar prompt de instalação:", e);
        toast.error("Não foi possível iniciar a instalação.");
      }
    } else if (isIOS() && !isInstalled) {
      toast.info("No iOS: toque em Compartilhar (Share) e depois em 'Adicionar à Tela de Início' (Add to Home Screen).");
    } else if (isInstalled) {
      toast.info("Aplicativo já instalado.");
    } else {
      // Este fallback só deve ser atingido se o navegador realmente não suportar PWAs
      toast.info("Instalação PWA não suportada neste navegador.");
    }
  };

  const { playNavigationSound } = useKeyboardNavigation({
    enabled: searchOpen && searchResults.length > 0,
    onEscape: () => setSearchOpen(false),
    onArrowUp: () => setFocusedResultIndex(prev => Math.max(prev - 1, 0)),
    onArrowDown: () => setFocusedResultIndex(prev => Math.min(prev + 1, searchResults.length - 1)),
    onEnter: () => {
      const selected = searchResults[focusedResultIndex];
      if (selected) {
        if (selected.category === 'nostalgia') {
          navigate(`/nostalgia/${selected.id}`);
        } else if (selected.category === 'series') {
          navigate(`/content/${selected.id}?showEpisodes=true`);
        } else {
          navigate(`/watch/${selected.id}`);
        }
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    },
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setFocusedResultIndex(0);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const allContent = await getAllContents();
      const filtered = allContent.filter((content) =>
        content.title.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
      playNavigationSound('focus');
    } catch (error) {
      toast.error("Erro ao buscar conteúdos");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logout realizado com sucesso!");
      navigate("/login");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <header className={`fixed top-0 ${hasSidebar ? 'left-14' : 'left-0'} right-0 z-50 bg-gradient-to-b ${enableBackdropBlur ? 'from-background/95 backdrop-blur-sm' : 'from-background/100'} to-transparent border-b border-border/40`}>
      <div className={`container mx-auto px-4 sm:px-8 ${hasSidebar ? 'py-2' : 'py-3 sm:py-4'}`}>
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Menu Trigger - hidden when sidebar active */}
            {!hasSidebar && (
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-300">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-background border-white/10 text-white w-[280px]">
                  <SheetHeader className="text-left border-b border-white/10 pb-4 mb-4">
                    <SheetTitle className="text-white flex items-center gap-2">
                      <Film className="w-5 h-5 text-primary" />
                      UniTvFilm
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-4">
                    <button
                      onClick={() => { navigate("/"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <Home className="w-5 h-5" />
                      Início
                    </button>

                    <button
                      onClick={() => { navigate("/categories"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <LayoutGrid className="w-5 h-5" />
                      Categorias
                    </button>

                    <button
                      onClick={() => { navigate("/tv"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <Tv className="w-5 h-5" />
                      TV Online
                    </button>

                    <button
                      onClick={() => { navigate("/transfers"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <Download className="w-5 h-5" />
                      Minhas Transferências
                    </button>
                    <button
                      onClick={() => { navigate("/iptv"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <MonitorPlay className="w-5 h-5" />
                      Gerar IPTV
                    </button>
                    <button
                      onClick={() => { navigate("/about"); }}
                      className="flex items-center gap-3 text-lg font-medium text-gray-300 hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                      <FileText className="w-5 h-5" />
                      Sobre Nós
                    </button>
                    <InstallAppButton />

                    <div className="pt-4 border-t border-white/10 mt-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Créditos Diários</p>
                      {user && plan && (
                        <div className="space-y-3 px-2">
                          {plan.limits.moviesPerDay !== -1 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Filmes</span>
                              <span className="text-white font-bold">{plan.limits.moviesPerDay - (profile?.credits?.moviesWatched || 0)} / {plan.limits.moviesPerDay}</span>
                            </div>
                          )}
                          {plan.limits.episodesPerDay !== -1 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Séries</span>
                              <span className="text-white font-bold">{plan.limits.episodesPerDay - (profile?.credits?.episodesWatched || 0)} / {plan.limits.episodesPerDay}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
            )}

            {/* Logo */}
            <div
              className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
              onClick={() => navigate("/")}
            >
              <div className="bg-primary p-1.5 sm:p-2 rounded-lg glow-effect group-hover:scale-110 transition-transform">
                <Film className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                Uni<span className="text-primary">Tv</span>Film
              </h1>
            </div>

            {/* Desktop Navigation - hidden when sidebar active (sidebar handles home/tv) */}
            {!hasSidebar && (
              <nav className="hidden md:flex items-center gap-6 ml-4">
                <button onClick={() => navigate("/")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Início
                </button>
                <button onClick={() => navigate("/tv")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                  TV Online
                  <span className="flex h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                </button>
                <button onClick={() => navigate("/transfers")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                  Minhas Transferências
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => navigate("/about")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Sobre Nós
                </button>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">


            {/* PWA Install Icon - hidden when sidebar active */}
            {!hasSidebar && <InstallAppButton variant="icon" className="text-gray-300 hover:text-white" />}

            {/* Search Icon - Navigates to search page */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/search")}
              className="text-gray-300 hover:text-white hover:bg-white/10 search-trigger"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Navigation items moved to the right when sidebar active */}
            {hasSidebar && (
              <nav className="hidden md:flex items-center gap-6 mr-4">
                <button onClick={() => navigate("/transfers")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                  Minhas Transferências
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => navigate("/iptv")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Gerar IPTV
                </button>
                <button onClick={() => navigate("/about")} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Sobre Nós
                </button>
              </nav>
            )}

            {/* Notification Bell - hidden when sidebar active (moved to sidebar) */}
            {!hasSidebar && (
            <div className="hidden sm:block">
              <NotificationBell />
            </div>
            )}

            {/* Credits Display - Desktop Only */}
            {user && plan && (plan.limits.moviesPerDay !== -1 || plan.limits.episodesPerDay !== -1) && (
              <div className="hidden lg:flex items-center gap-3 mr-2">
                {plan.limits.moviesPerDay !== -1 && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${(profile?.credits?.moviesWatched || 0) >= plan.limits.moviesPerDay
                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-300'
                    }`}>
                    <Clapperboard className="w-3.5 h-3.5" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Filmes</span>
                      <span className="text-xs font-bold text-white">
                        {plan.limits.moviesPerDay - (profile?.credits?.moviesWatched || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {plan.limits.episodesPerDay !== -1 && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${(profile?.credits?.episodesWatched || 0) >= plan.limits.episodesPerDay
                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-300'
                    }`}>
                    <Tv className="w-3.5 h-3.5" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Séries</span>
                      <span className="text-xs font-bold text-white">
                        {plan.limits.episodesPerDay - (profile?.credits?.episodesWatched || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Menu / Logout Icon */}
            {user ? (
              !hasSidebar ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-1 sm:gap-2 cursor-pointer group">
                      <div className="w-8 h-8 rounded overflow-hidden border border-transparent group-hover:border-white transition-all">
                        <img
                          src={currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <ChevronDown className="w-4 h-4 text-white hidden sm:block group-hover:rotate-180 transition-transform duration-200" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-black/95 border-white/10 text-white backdrop-blur-xl">
                    <DropdownMenuLabel className="text-gray-400 text-xs uppercase tracking-wider">Conta</DropdownMenuLabel>
                    <div className="px-2 py-1 flex items-center gap-2 mb-2">
                      <img
                        src={currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                        className="w-6 h-6 rounded object-cover"
                      />
                      <span className="text-sm font-bold truncate">{currentProfile?.name || "Usuário"}</span>
                    </div>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => navigate("/profiles")} className="focus:bg-white/10 cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Gerenciar Perfis
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="focus:bg-white/10 cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Conta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/my-list")} className="focus:bg-white/10 cursor-pointer">
                      <List className="mr-2 h-4 w-4" />
                      Minha Lista
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/transfers")} className="focus:bg-white/10 cursor-pointer">
                      <Download className="mr-2 h-4 w-4" />
                      Minhas Transferências
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="focus:bg-white/10 cursor-pointer text-yellow-500 hover:text-yellow-400">
                        <Settings className="mr-2 h-4 w-4" />
                        Painel Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleLogout} className="text-white hover:underline cursor-pointer focus:bg-transparent justify-center text-xs py-3">
                      Sair da UniTvFilm
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                  title="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              )
            ) : (
              <Button
                onClick={() => navigate("/login")}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4"
              >
                Entrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};