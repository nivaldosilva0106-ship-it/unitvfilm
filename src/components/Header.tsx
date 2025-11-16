import { Film, Search, User, LogOut, List, Settings, Home, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAllContents } from "@/lib/firebase";
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
  const { user, isAdmin, logout } = useAuth();
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
  }, [deferredPrompt]); // Dependência adicionada para reavaliar a visibilidade

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

          <div className="flex items-center gap-2 flex-shrink-0">
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
                  variant="outline" 
                  size="icon" 
                  className="border-primary/50 hover:border-primary hover:bg-primary/10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2">
                  <Input
                    placeholder="Pesquisar conteúdo..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="mb-2"
                    autoFocus
                  />
                  {isSearching && (
                    <p className="text-sm text-muted-foreground text-center py-2">Buscando...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
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
                          className={`w-full text-left p-2 rounded-md transition-colors ${
                            focusedResultIndex === index 
                              ? 'bg-primary text-primary-foreground' 
                              : 'hover:bg-accent'
                          }`}
                        >
                          <p className="font-medium text-sm">{content.title}</p>
                          <p className={`text-xs ${
                            focusedResultIndex === index 
                              ? 'text-primary-foreground/80' 
                              : 'text-muted-foreground'
                          } capitalize`}>{content.category}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum resultado encontrado
                    </p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Dropdown */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="border-primary/50 hover:border-primary hover:bg-primary/10"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/")}>
                    <Home className="mr-2 h-4 w-4" />
                    Início
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/my-list")}>
                    <List className="mr-2 h-4 w-4" />
                    Minha Lista
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                size="sm"
                className="border-primary/50 hover:border-primary hover:bg-primary/10"
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