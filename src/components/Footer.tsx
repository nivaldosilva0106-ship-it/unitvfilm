import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Monitor, Apple } from 'lucide-react';
import { Button } from './ui/button';
import { useAppConfig } from '@/hooks/useAppConfig';

export function Footer() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const { enableBackdropBlur } = useAppConfig();

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async (platform: 'android' | 'ios' | 'pc') => {
        if (platform === 'ios') {
            alert("Para instalar no iOS: Toque no botão de compartilhamento e selecione 'Adicionar à Tela de Início'.");
            return;
        }

        if (!deferredPrompt) {
            if (platform === 'pc') {
                alert("Para instalar no PC, clique no ícone de instalação na barra de endereço do navegador (Chrome/Edge).");
            } else {
                alert("App já instalado ou não suportado neste navegador. Tente pelo Chrome.");
            }
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    return (
        <footer className={`w-full ${enableBackdropBlur ? 'bg-black/40 backdrop-blur-sm' : 'bg-black'} border-t border-white/5 py-8 mt-auto`}>
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Left side - Brand & Copyright with Install Icons */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="text-center sm:text-left">
                            <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-1">
                                UniTvFilm
                            </h3>
                            <p className="text-sm text-gray-400">
                                &copy; {new Date().getFullYear()} UniTvFilm. Todos os direitos reservados.
                            </p>
                        </div>
                        
                        {/* Install App Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleInstallClick('android')}
                                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all group"
                                title="Baixar para Android"
                            >
                                <Smartphone className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleInstallClick('ios')}
                                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all group"
                                title="Baixar para iOS"
                            >
                                <Apple className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleInstallClick('pc')}
                                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all group"
                                title="Instalar no PC"
                            >
                                <Monitor className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                            </Button>
                        </div>
                    </div>

                    {/* Right side - Links */}
                    <div className="flex flex-wrap items-center justify-center gap-6">
                        <Link
                            to="/about"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Sobre Nós
                        </Link>
                        <Link
                            to="/terms"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Termos de Uso
                        </Link>
                        <Link
                            to="/privacy"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Política de Privacidade
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
