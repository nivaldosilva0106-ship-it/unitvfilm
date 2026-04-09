import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { AppInstallDialog } from './AppInstallDialog';

export const InstallAppButton = ({ className, text, variant = 'default' }: { className?: string, text?: string, variant?: 'default' | 'icon' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const isIOS = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(ua);
    };

    const isStandalone = () => {
      return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    };

    const checkInstalled = () => {
      const installed = isStandalone();
      setIsInstalled(installed);
      setIsVisible(!installed);
    };

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      checkInstalled();
    };

    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsInstalled(true);
      setIsVisible(false);
      toast.success("Aplicativo instalado com sucesso!");
    });

    checkInstalled();

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [deferredPrompt]);

  const handleInstallClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsDialogOpen(true);
  };

  const onInstallPWA = async () => {
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
          toast.success("Instalação iniciada");
          setIsDialogOpen(false);
        } else {
          toast.info("Instalação cancelada");
        }
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      } catch (err) {
        toast.error("Erro ao instalar aplicativo.");
      }
    } else if (isIOS() && !isInstalled) {
      toast.info("No iOS: toque em Compartilhar (Share) e depois em 'Adicionar à Tela de Início' (Add to Home Screen).", { duration: 6000 });
      setIsDialogOpen(false);
    } else {
      toast.info("Instalação PWA não disponível. Pode usar o menu do seu navegador.");
      setIsDialogOpen(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleInstallClick}
          className={className || "text-gray-300 hover:text-white"}
          title="Instalar aplicativo"
        >
          <Download className="h-5 w-5" />
        </Button>
      ) : (
        <button
          onClick={handleInstallClick}
          className={className || "flex items-center gap-3 text-lg font-medium text-[#0aff7a] hover:text-[#0aff7a]/80 transition-colors p-2 rounded-lg hover:bg-[#0aff7a]/20 border border-[#0aff7a]/30 bg-[#0aff7a]/10"}
        >
          <Download className="w-5 h-5" />
          {text || "Instalar App"}
        </button>
      )}

      <AppInstallDialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onInstallPWA={onInstallPWA}
      />
    </>
  );
};
