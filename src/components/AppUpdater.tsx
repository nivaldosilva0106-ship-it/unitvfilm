import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { Download, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export function AppUpdater() {
    const [updateRequired, setUpdateRequired] = useState(false);
    const [apkUrl, setApkUrl] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUpdate = async () => {
            if (!Capacitor.isNativePlatform()) {
                setLoading(false);
                return;
            }

            try {
                // Dynamic import so Rollup doesn't try to bundle @capacitor/app for web builds
                const { App: CapacitorApp } = await import('@capacitor/app');
                
                const settings = await getSiteSettings();
                const requiredVersion = settings.requiredAppVersion || 1;
                
                const info = await CapacitorApp.getInfo();
                const currentBuild = parseInt(info.build || '1');

                if (currentBuild < requiredVersion) {
                    setUpdateRequired(true);
                    setApkUrl(settings.apkDownloadUrl || '');
                }
            } catch (e) {
                console.error("Failed to check for app update", e);
            } finally {
                setLoading(false);
            }
        };

        checkUpdate();
    }, []);

    if (loading || !updateRequired) return null;

    const handleUpdate = () => {
        if (apkUrl) {
            window.location.href = apkUrl;
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-sm">
                <div className="mb-8 flex flex-col items-center">
                    <div className="relative mb-6">
                        <div className="w-24 h-24 bg-zinc-900 rounded-3xl border border-white/10 p-5 flex items-center justify-center shadow-2xl">
                            <img src="/favicon.png" alt="UniTvFilm" className="w-full h-full object-contain" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-red-500 rounded-full p-2 border-4 border-[#0a0a0a]">
                            <RefreshCw className="w-4 h-4 text-white animate-spin-slow" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase italic">
                        UniTv<span className="text-emerald-500">Film</span>
                    </h1>
                    <div className="h-1 w-12 bg-emerald-500 rounded-full mb-6" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-4">Nova Versão Disponível!</h2>
                
                <p className="text-gray-400 mb-10 leading-relaxed">
                    Para garantir que você tenha a melhor experiência possível, é necessário baixar a nova versão do UniTvFilm. Esta atualização contém correções importantes e melhorias de segurança obrigatórias.
                </p>
                
                <div className="space-y-4">
                    <Button 
                        onClick={handleUpdate} 
                        disabled={!apkUrl}
                        className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg w-full transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
                    >
                        <Download className="w-5 h-5" />
                        Baixar e Atualizar
                    </Button>
                    
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                        Acesso obrigatório para continuar
                    </p>
                </div>
            </div>
        </div>
    );
}
