import React from "react";
import { X, Smartphone, Globe, Download, Info } from "lucide-react";
import { Button } from "./ui/button";
import { getSiteSettings, type SiteSettings } from "@/lib/firebase";
import { useEffect, useState } from "react";

interface AppInstallDialogProps {
  open: boolean;
  onClose: () => void;
  onInstallPWA: () => void;
}

export const AppInstallDialog = ({ open, onClose, onInstallPWA }: AppInstallDialogProps) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const s = await getSiteSettings();
      setSettings(s);
    };
    loadSettings();

    const ua = window.navigator.userAgent.toLowerCase();
    setIsAndroid(/android/.test(ua));
    setIsIOS(/iphone|ipad|ipod/.test(ua));
  }, []);

  if (!open) return null;

  const handleDownloadAPK = () => {
    if (settings?.apkDownloadUrl) {
      window.open(settings.apkDownloadUrl, "_blank");
      onClose();
    }
  };

  const appIcon = settings?.pwaIconUrl || "/favicon.png";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative bg-[#1a1a1a] border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-white/10 shadow-xl overflow-hidden">
            <img src={appIcon} alt="UniTvFilm Logo" className="w-full h-full object-contain p-3" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Instalar UniTvFilm</h3>
            <p className="text-zinc-400 text-sm leading-relaxed px-4">
              Escolha a melhor forma de aceder ao nosso conteúdo premium no seu dispositivo.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {/* PWA Option */}
            {settings?.enablePwaInstall !== false && (
              <button
                onClick={onInstallPWA}
                className="w-full group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-white uppercase text-xs tracking-widest">Web App (PWA)</div>
                  <div className="text-[11px] text-zinc-500">Ideal para iPhone e Desktop</div>
                </div>
              </button>
            )}

            {/* APK Option - Particularly for Android */}
            {(settings?.enableApkDownload && (isAndroid || !isIOS)) && (
              <button
                onClick={handleDownloadAPK}
                className="w-full group flex items-center gap-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-2xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-primary uppercase text-xs tracking-widest">App Android (APK)</div>
                  <div className="text-[11px] text-zinc-500 italic">Melhor experiência no Android</div>
                </div>
                <Download className="w-5 h-5 text-primary opacity-50" />
              </button>
            )}

            {/* iOS Message */}
            {isIOS && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-left">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-200/80 leading-snug">
                  No iOS, selecione <strong>"Adicionar à Tela de Início"</strong> no menu de partilha do seu navegador para instalar o Web App.
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 text-[10px] text-zinc-600 font-medium uppercase tracking-widest">
            UniTvFilm • Versão Premium
          </div>
        </div>
      </div>
    </div>
  );
};
