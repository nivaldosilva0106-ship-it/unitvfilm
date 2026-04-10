import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/firebase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

export function AppUpdater() {
    const [updateRequired, setUpdateRequired] = useState(false);
    const [apkUrl, setApkUrl] = useState('');

    useEffect(() => {
        const checkUpdate = async () => {
            if (!Capacitor.isNativePlatform()) return;

            try {
                const settings = await getSiteSettings();
                const requiredVersion = settings.requiredAppVersion || 1;
                
                const info = await CapacitorApp.getInfo();
                const currentVersion = parseInt(info.version || '1'); // Native App VersionCode or just VersionName
                
                // Compare numeric versions (for Android versionCode)
                // App.getInfo().build provides versionCode on Android
                const currentBuild = parseInt(info.build || '1');

                if (currentBuild < requiredVersion) {
                    setUpdateRequired(true);
                    setApkUrl(settings.apkDownloadUrl || '');
                }
            } catch (e) {
                console.error("Failed to check for app update", e);
            }
        };

        checkUpdate();
    }, []);

    if (!updateRequired) return null;

    const handleUpdate = () => {
        if (apkUrl) {
            window.location.href = apkUrl;
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-6 rounded-full bg-red-500/20 p-6 animate-pulse">
                <AlertCircle className="h-16 w-16 text-yellow-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">Atualização Necessária</h1>
            
            <p className="text-gray-400 max-w-md mx-auto mb-8 text-lg">
                Sua versão do aplicativo está desatualizada. Por favor, baixe a nova versão para continuar usando o UniTvFilm com todos os novos recursos e correções (Importante).
            </p>
            
            <Button 
                onClick={handleUpdate} 
                disabled={!apkUrl}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-xl font-medium text-lg w-full max-w-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-3"
            >
                <Download className="w-5 h-5" />
                Baixar Nova Versão Agora
            </Button>
        </div>
    );
}
