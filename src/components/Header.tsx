import { Film, Search, User, LogOut, List, Settings, Home, Download, ChevronDown, Clapperboard, Tv } from "lucide-react";
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
import { Input } from "./ui/input";
import { toast } from "sonner";
import type { Content } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

export const Header = () => {
  const navigate = useNavigate();
  const { user, profile, plan, isAdmin, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);

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
      if (searchResults[focusedResultIndex]) {
        navigate(`/content/${searchResults[focusedResultIndex].id}`);
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
            onClick={() => navigate("/")}
          >
            <div className="bg-primary p-2 rounded-lg glow-effect group-hover:scale-110 transition-transform">
              <Film className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Uni<span className="text-primary">Tv</span>Film
            </h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 ml-8">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Início
            </button>
            <button onClick={() => navigate("/my-list")} className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Minha Lista
            </button>
            <button onClick={() => navigate("/categories")} className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Categorias
            </button>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* PWA Install Icon */}
            {installButtonVisible && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleInstallPWA}
                className="border-primary/50 hover:border-primary hover:bg-primary/10"
                title="Instalar aplicativo"
              >
                <Download className="h-5 w-5" />
              </Button>
            )}

            {/* Search Icon with Dropdown */}
            <DropdownMenu open={searchOpen} onOpenChange={setSearchOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-[#141414] border-white/10 text-white">
                <div className="p-2">
                  <Input
                    placeholder="Pesquisar conteúdo..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="mb-2 bg-[#333] border-none text-white focus-visible:ring-1 focus-visible:ring-white/20"
                    autoFocus
                  />
                  {isSearching && (
                    <p className="text-sm text-gray-400 text-center py-2">Buscando...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar">
                      {searchResults.slice(0, 5).map((content, index) => (
                        <button
                          key={content.id}
                          onClick={() => {
                            playNavigationSound('select');
                            navigate(`/content/${content.id}`);
                            setSearchOpen(false);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className={`w-full text-left p-2 rounded-md transition-colors flex gap-3 ${focusedResultIndex === index
                            ? 'bg-white/10 text-white'
                            : 'hover:bg-white/5 text-gray-300'
                            }`}
                        >
                          <img src={content.thumbnail_url} className="w-8 h-12 object-cover rounded bg-zinc-800" />
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{content.title}</p>
                            <p className={`text-xs ${focusedResultIndex === index
                              ? 'text-gray-300'
                              : 'text-gray-500'
                              } capitalize`}>{content.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      Nenhum resultado encontrado
                    </p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            <div className="mr-2 hidden md:block">
              <NotificationBell />
            </div>

            {/* Credits Display for Limited Plans */}
            {user && plan && (plan.limits.moviesPerDay !== -1 || plan.limits.episodesPerDay !== -1) && (
              <div className="hidden md:flex items-center gap-3 mr-4">
                {/* Movies Pill */}
                {plan.limits.moviesPerDay !== -1 && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${(profile?.credits?.moviesWatched || 0) >= plan.limits.moviesPerDay
                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-300'
                    }`}>
                    <Clapperboard className="w-3.5 h-3.5" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Filmes</span>
                      <span className="text-xs font-bold text-white">
                        {plan.limits.moviesPerDay - (profile?.credits?.moviesWatched || 0)} <span className="text-gray-500 text-[10px] font-normal">/ {plan.limits.moviesPerDay}</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Episodes Pill */}
                {plan.limits.episodesPerDay !== -1 && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all ${(profile?.credits?.episodesWatched || 0) >= plan.limits.episodesPerDay
                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-300'
                    }`}>
                    <Tv className="w-3.5 h-3.5" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Séries</span>
                      <span className="text-xs font-bold text-white">
                        {plan.limits.episodesPerDay - (profile?.credits?.episodesWatched || 0)} <span className="text-gray-500 text-[10px] font-normal">/ {plan.limits.episodesPerDay}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer group ml-2">
                    <div className="w-8 h-8 rounded overflow-hidden border border-transparent group-hover:border-white transition-all">
                      <img
                        src={useAuth().currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <ChevronDown className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-200" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-black/95 border-white/10 text-white backdrop-blur-xl">
                  <DropdownMenuLabel className="text-gray-400 text-xs uppercase tracking-wider">Conta</DropdownMenuLabel>
                  <div className="px-2 py-1 flex items-center gap-2 mb-2">
                    <img
                      src={useAuth().currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                      className="w-6 h-6 rounded object-cover"
                    />
                    <span className="text-sm font-bold truncate">{useAuth().currentProfile?.name || "Usuário"}</span>
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
                onClick={() => navigate("/login")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground ml-2"
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