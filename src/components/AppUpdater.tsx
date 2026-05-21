import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { Download, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { useAppConfig } from '@/hooks/useAppConfig';
import { Progress } from './ui/progress';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';

export function AppUpdater() {
    const [updateRequired, setUpdateRequired] = useState(false);
    const [apkUrl, setApkUrl] = useState('');
    const [updateNotes, setUpdateNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloaded, setDownloaded] = useState(false);
    const { isLiteMode } = useAppConfig();

    useEffect(() => {
        const checkUpdate = async () => {
            if (!Capacitor.isNativePlatform()) {
                setLoading(false);
                return;
            }

            try {
                // Dynamic import for Capacitor App plugin
                const { App: CapacitorApp } = await import('@capacitor/app');
                
                const settings = await getSiteSettings();
                const requiredVersionRaw = isLiteMode 
                    ? (settings.requiredLiteAppVersion || '1.0.0') 
                    : (settings.requiredAppVersion || '1.0.0');
                const requiredVersion = requiredVersionRaw.toString();
                
                const info = await CapacitorApp.getInfo();
                const currentVersion = info.version || '1.0.0';

                // Helper to compare semantic versions (e.g. 1.0.1 > 1.0.0)
                const isOutdated = (current: string, required: string) => {
                    const cParts = current.split('.').map(Number);
                    const rParts = required.split('.').map(Number);
                    for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
                        const c = cParts[i] || 0;
                        const r = rParts[i] || 0;
                        if (c < r) return true;
                        if (c > r) return false;
                    }
                    return false;
                };

                // Fallback for old number builds
                const currentBuild = parseInt(info.build || '1');
                const reqBuild = parseInt(requiredVersion);
                
                let needsUpdate = false;
                if (!isNaN(reqBuild) && !requiredVersion.includes('.')) {
                    // Legacy check
                    needsUpdate = currentBuild < reqBuild;
                } else {
                    needsUpdate = isOutdated(currentVersion, requiredVersion);
                }

                if (needsUpdate) {
                    setUpdateRequired(true);
                    setUpdateNotes(settings.appUpdateNotes || "Resolvemos alguns problemas e melhoramos a performance.");
                    setApkUrl(isLiteMode 
                        ? (settings.apkLiteDownloadUrl || settings.apkDownloadUrl || '') 
                        : (settings.apkDownloadUrl || '')
                    );
                }
            } catch (e) {
                console.error("Failed to check for app update", e);
            } finally {
                setLoading(false);
            }
        };

        checkUpdate();
    }, [isLiteMode]);

    const handleDownloadAndInstall = async () => {
        if (!apkUrl) return;

        // If it's not Android or if we want the simplest path
        if (Capacitor.getPlatform() !== 'android') {
            window.location.href = apkUrl;
            return;
        }

        try {
            setDownloading(true);
            setProgress(0);

            // 1. Download the file using Filesystem
            // Note: In Capacitor 6/7, downloadFile returns progress
            const filename = `unitvfilm_update_${Date.now()}.apk`;
            
            const downloadResult = await Filesystem.downloadFile({
                url: apkUrl,
                path: filename,
                directory: Directory.Data,
                progress: true
            });

            // We simulate progress if the plugin doesn't provide granular updates in this environment
            // but usually downloadFile on Android provides updates via listeners if implemented, 
            // otherwise we'll just wait for the result.
            
            setProgress(100);
            setDownloaded(true);
            setDownloading(false);
            
            toast.success("Download concluído! Iniciando instalação...");

            // 2. Open the file to trigger installation
            // We use the browser to open the local file URL which triggers Android's installer
            const fileUri = downloadResult.path;
            if (fileUri) {
                // On Android, opening an APK file usually triggers the Package Installer
                window.location.href = Capacitor.convertFileSrc(fileUri);
            }

        } catch (error) {
            console.error("Download failed:", error);
            setDownloading(false);
            toast.error("Falha ao baixar atualização. Tentando via navegador...");
            // Fallback to browser download
            window.location.href = apkUrl;
        }
    };

    if (loading || !updateRequired) return null;

    return (
        <div className="fixed inset-0 z-[100000] bg-[#050505] flex flex-col items-center justify-center p-6 text-center overflow-hidden font-sans">
            {/* Immersive Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />

            <div className="relative z-10 w-full max-w-md bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
                {/* Header Icon */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="relative">
                        <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl border border-white/10 p-4 flex items-center justify-center shadow-inner overflow-hidden">
                            <img src="/favicon.png" alt="UniTvFilm" className="w-full h-full object-contain" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-2 border-4 border-[#0a0a0a] shadow-lg">
                            <RefreshCw className={`w-4 h-4 text-white ${downloading ? 'animate-spin' : ''}`} />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 mb-6">
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        ATUALIZAÇÃO <span className="text-emerald-500 italic">DISPONÍVEL</span>
                    </h1>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Versão Obrigatória</p>
                </div>

                {/* Release Notes Card */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 mb-8 text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Zap className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h3 className="text-emerald-500 font-bold text-xs uppercase mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3" /> O que há de novo:
                    </h3>
                    <p className="text-zinc-300 text-sm leading-relaxed italic">
                        "{updateNotes}"
                    </p>
                </div>

                {!downloading && !downloaded && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3">
                            <Button 
                                onClick={handleDownloadAndInstall} 
                                className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg w-full transition-all shadow-xl shadow-emerald-500/20 group overflow-hidden relative active:scale-95"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    <Download className="w-6 h-6 group-hover:bounce" />
                                    Atualizar Agora
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            </Button>
                        </div>
                        <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-[0.2em]">
                            UniTvFilm • Sistema de Auto-Instalação
                        </p>
                    </div>
                )}

                {downloading && (
                    <div className="space-y-6 py-4">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-white font-bold text-sm">Baixando APK...</span>
                            <span className="text-emerald-500 font-mono text-sm">{progress}%</span>
                        </div>
                        <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                                className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-zinc-500 text-[10px] italic">Não feche o aplicativo durante o download</p>
                    </div>
                )}

                {downloaded && (
                    <div className="space-y-6 py-4 animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Download Concluído</h3>
                                <p className="text-zinc-400 text-sm">Iniciando instalação automática...</p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleDownloadAndInstall}
                            variant="outline"
                            className="w-full border-white/10 text-white hover:bg-white/5 rounded-xl h-12"
                        >
                            Tentar novamente se não abrir
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
