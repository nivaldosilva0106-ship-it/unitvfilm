import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

export const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    const isIOS = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(ua);
    };

    const isStandalone = () => {
      return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    };

    const checkPWAStatus = () => {
      const installed = isStandalone();
      setIsInstalled(installed);
      
      const dismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';
      
      // Show banner if:
      // 1. Not installed
      // 2. Not dismissed
      // 3. Either it's iOS or we have the install prompt (or it's potentially available)
      if (!installed && !dismissed) {
        setShowBanner(true);
      }
    };

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      checkPWAStatus();
    };

    // If already captured globally
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsInstalled(true);
      setShowBanner(false);
      localStorage.setItem('pwa_banner_dismissed', 'true');
      toast.success("UniTvFilm instalado com sucesso!");
    });

    // Check status on mount
    const timer = setTimeout(checkPWAStatus, 2000); // Small delay to let initial loads finish

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    const isIOS = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(ua);
    };

    const promptEvent = deferredPrompt || (window as any).deferredPrompt;
    
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          setShowBanner(false);
          localStorage.setItem('pwa_banner_dismissed', 'true');
        }
      } catch (err) {
        console.error("PWA Prompt error", err);
      }
    } else if (isIOS()) {
      setShowIosInstructions(true);
    } else {
      toast.info("Para instalar: abra o menu do navegador e selecione 'Adicionar à tela inicial'.");
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner || isInstalled) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:max-w-sm md:bottom-20 md:right-8 animate-in slide-in-from-bottom-5 duration-500">
        <div className="bg-[#1a1a1a] border border-[#0aff7a]/30 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_15px_rgba(10,255,122,0.1)] backdrop-blur-xl relative overflow-hidden group">
          {/* subtle glow effect */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#0aff7a]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex gap-4 items-start mb-4">
            <div className="w-12 h-12 bg-[#0aff7a] rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(10,255,122,0.4)]">
              <Globe className="w-7 h-7 text-black" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white text-base">Instalar UniTvFilm</h4>
              <p className="text-gray-400 text-xs leading-relaxed">
                Aceda mais rápido e com melhor performance instalando o nosso App.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleInstallClick}
              className="flex-1 bg-[#0aff7a] text-black hover:bg-[#0aff7a]/90 font-bold h-11"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalar Agora
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              className="border-gray-700 text-gray-400 hover:text-white hover:bg-white/5 h-11"
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosInstructions && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowIosInstructions(false)} />
          <div className="relative bg-[#1a1a1a] border border-gray-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <button
              onClick={() => setShowIosInstructions(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-full flex items-center justify-center mx-auto text-[#0aff7a]">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Instalar no iPhone</h3>
              <div className="text-sm text-gray-300 text-left space-y-3 font-medium">
                <p>1. Toque no botão <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-700 rounded mx-1 pb-0.5"><Download className="w-4 h-4 rotate-180" /></span> (Compartilhar) na barra inferior.</p>
                <p>2. Role para baixo e selecione <span className="bg-gray-700 px-2 py-0.5 rounded text-white">+ Adicionar à Tela de Início</span>.</p>
                <p>3. Toque em <strong>Adicionar</strong> no canto superior.</p>
              </div>
              <Button 
                className="w-full bg-[#0aff7a] text-black font-bold h-12" 
                onClick={() => {
                  setShowIosInstructions(false);
                  handleDismiss();
                }}
              >
                Entendi
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
