import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
import { useAuth } from "@/contexts/AuthContext";
import { addTransfer } from "@/lib/firebase";
import { createSecureDownloadUrl, createSecurePlaybackUrl, isProtectedUrl } from "@/lib/secure-url";
import { toast } from "sonner";

interface DownloadModalProps {
    open: boolean;
    onClose: () => void;
    downloadUrl: string; // Legacy support
    downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[];
    download_mode?: 'direct' | 'torrent' | 'mixed';
    title: string;
    thumbnail?: string;
    contentId: string;
}

export const DownloadModal = ({ open, onClose, downloadUrl, downloads, download_mode = 'direct', title, thumbnail, contentId }: DownloadModalProps) => {
    const { user } = useAuth();
    
    // Links selection state
    const [selectedLink, setSelectedLink] = useState<{ label: string; url: string; type?: string } | null>(null);
    
    // Resolution state
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [resolveError, setResolveError] = useState<string | null>(null);
    
    // Countdown state
    const [countdown, setCountdown] = useState<number>(10);
    const [isTimerFinished, setIsTimerFinished] = useState(false);
    
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);

    // Raw and effective links
    const rawLinks = (downloads && downloads.length > 0)
        ? downloads
        : (downloadUrl ? [{ label: 'Download Principal', url: downloadUrl, type: download_mode === 'torrent' ? 'torrent' : 'direct' as const }] : []);

    const effectiveLinks = rawLinks.map(link => ({
        ...link,
        originalUrl: link.url
    }));

    // Reset state on open/close
    useEffect(() => {
        if (!open) {
            setSelectedLink(null);
            setResolvedUrl(null);
            setPlaybackUrl(null);
            setIsResolving(false);
            setResolveError(null);
            setCountdown(10);
            setIsTimerFinished(false);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        } else {
            // If only one option, automatically select it and start resolving
            if (effectiveLinks.length === 1) {
                handleSelectLink(effectiveLinks[0]);
            }
        }
    }, [open, downloads, downloadUrl]);

    // Handle link resolution
    const handleSelectLink = async (link: { label: string; url: string; type?: string }) => {
        setSelectedLink(link);
        setIsResolving(true);
        setResolveError(null);
        setResolvedUrl(null);
        setPlaybackUrl(null);
        setCountdown(10);
        setIsTimerFinished(false);

        try {
            let targetUrl = link.url;

            // 1. TikTok Links
            if (targetUrl.toLowerCase().includes("tiktok.com")) {
                const response = await fetch(`/api/tiktok?url=${encodeURIComponent(targetUrl)}`);
                if (!response.ok) throw new Error("Erro ao obter o link do TikTok.");
                const data = await response.json();
                if (data && data.url) {
                    targetUrl = data.url;
                } else {
                    throw new Error("Formato inválido retornado pelo TikTok.");
                }
            }
            // 2. TXT Links
            else if (targetUrl.toLowerCase().split('?')[0].endsWith('.txt')) {
                const proxyUrl = createSecurePlaybackUrl(targetUrl);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error("Erro ao ler o arquivo de download.");
                const text = await response.text();
                const trimmed = text.trim();
                const lines = trimmed.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
                if (lines.length >= 1) {
                    const firstLine = lines[0].trim();
                    if (firstLine.startsWith('http://') || firstLine.startsWith('https://')) {
                        targetUrl = firstLine;
                    }
                }
            }

            // Apply Secure URL proxy if protected
            let playUrl = targetUrl;
            if (isProtectedUrl(targetUrl)) {
                playUrl = createSecurePlaybackUrl(targetUrl);
            }

            setResolvedUrl(targetUrl);
            setPlaybackUrl(playUrl);
            setCountdown(10);
        } catch (err: any) {
            console.error("Error resolving link:", err);
            setResolveError(err.message || "Erro ao processar o link de download.");
            // Fallback to original URL
            setResolvedUrl(link.url);
            setPlaybackUrl(isProtectedUrl(link.url) ? createSecurePlaybackUrl(link.url) : link.url);
            setCountdown(10);
        } finally {
            setIsResolving(false);
        }
    };

    // Video playback effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !playbackUrl || !open) return;

        // Clean up previous instance
        video.src = "";
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const isHls = playbackUrl.toLowerCase().split('?')[0].endsWith('.m3u8') || 
                      playbackUrl.toLowerCase().split('?')[0].endsWith('.m3u') ||
                      playbackUrl.includes('typezero.top') ||
                      playbackUrl.includes('.m3u8');

        video.muted = true;
        video.playsInline = true;

        const attemptPlay = async () => {
            try {
                await video.play();
            } catch (err) {
                console.log("Autoplay failed:", err);
            }
        };

        if (isHls && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hls.loadSource(playbackUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                attemptPlay();
            });
            hlsRef.current = hls;
        } else {
            video.src = playbackUrl;
            video.addEventListener('loadedmetadata', attemptPlay);
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [playbackUrl, open]);

    // Countdown effect
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (playbackUrl && countdown > 0 && !isResolving) {
            timer = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (playbackUrl && countdown === 0 && !isResolving) {
            setIsTimerFinished(true);
            if (videoRef.current) {
                videoRef.current.pause();
            }
        }
        return () => clearTimeout(timer);
    }, [playbackUrl, countdown, isResolving]);

    // Handle Download Action
    const handleDownloadClick = async () => {
        if (!resolvedUrl) return;

        // Create secure download URL if protected
        const downloadLink = isProtectedUrl(resolvedUrl)
            ? createSecureDownloadUrl(resolvedUrl, `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
            : resolvedUrl;

        // Track in firebase
        if (user) {
            try {
                await addTransfer(user.uid, {
                    contentId,
                    title,
                    thumbnailUrl: thumbnail,
                    url: downloadLink
                });
            } catch (error) {
                console.error("Error tracking transfer:", error);
            }
        }

        window.open(downloadLink, '_blank');
        onClose();
        toast.success("Download iniciado!");
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[420px] bg-[#121212]/95 border-[#222]/80 backdrop-blur-xl text-white p-6 shadow-2xl rounded-2xl flex flex-col gap-5 border">
                {/* Header */}
                <div className="flex flex-col items-center w-full">
                    <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Download className="w-6 h-6 text-emerald-400 animate-bounce" />
                    </div>
                    <h2 className="text-lg font-bold text-center bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                        {selectedLink ? `Preparando: ${title}` : "Opções de Download"}
                    </h2>
                    {selectedLink && selectedLink.label && (
                        <p className="text-xs text-emerald-400 font-semibold mt-1 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">
                            {selectedLink.label}
                        </p>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="w-full flex flex-col items-center min-h-[160px] justify-center">
                    {!selectedLink ? (
                        /* Link Selection list (shown only if multiple options are available) */
                        <div className="w-full flex flex-col gap-3">
                            <p className="text-xs text-gray-400 text-center mb-1">
                                Selecione uma opção para iniciar o processamento do link:
                            </p>
                            {effectiveLinks.map((link, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectLink(link)}
                                    className="w-full bg-[#1c1c1c] hover:bg-[#252525] active:bg-[#181818] border border-white/5 hover:border-emerald-500/30 text-white rounded-xl py-3 px-4 flex items-center justify-between transition-all duration-300 group shadow-md"
                                >
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-bold text-sm group-hover:text-emerald-400 transition-colors line-clamp-1">
                                            {link.label || `Download ${idx + 1}`}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                            {link.type || (download_mode === 'torrent' ? 'Torrent' : 'Direto')}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all shrink-0 ml-2">
                                        <Download className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : isResolving ? (
                        /* Loading state while resolving URL */
                        <div className="flex flex-col items-center justify-center py-6 gap-3">
                            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                            <p className="text-sm text-gray-300 font-medium animate-pulse">Obtendo link temporário seguro...</p>
                        </div>
                    ) : resolveError ? (
                        /* Error state if resolving fails */
                        <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                            <p className="text-sm text-red-400 font-medium">{resolveError}</p>
                            <Button 
                                onClick={() => handleSelectLink(selectedLink)}
                                className="mt-2 bg-[#22c55e] hover:bg-[#22c55e]/90 text-black font-bold text-xs px-4 py-2"
                            >
                                Tentar Novamente
                            </Button>
                        </div>
                    ) : (
                        /* Player and Timer Container */
                        <div className="w-full flex flex-col items-center gap-4">
                            {/* Tiny Video Player with premium design */}
                            <div className="relative w-full max-w-[280px] aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.1)] group">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover"
                                    playsInline
                                    muted
                                />
                                
                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                                {/* Monospace Glowing Countdown Timer Overlay */}
                                <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/85 border border-white/10 flex items-center gap-1.5 shadow-md">
                                    <div className={`w-2 h-2 rounded-full ${isTimerFinished ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                                    <span className="text-xs font-mono font-bold tracking-wider text-white">
                                        {isTimerFinished ? "00:00" : `00:${countdown.toString().padStart(2, '0')}`}
                                    </span>
                                </div>

                                {/* Watermark/Badge */}
                                <div className="absolute bottom-2 left-2 text-[9px] uppercase font-bold tracking-widest text-white/50">
                                    Player Temporário
                                </div>
                            </div>

                            {/* Status message */}
                            <div className="text-center px-2">
                                {isTimerFinished ? (
                                    <p className="text-xs text-emerald-400 font-bold animate-pulse">
                                        Link temporário gerado com sucesso! Pronto para download.
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-400 animate-pulse">
                                        Carregando stream no player para gerar o link...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {selectedLink && (
                    <div className="w-full space-y-3 pt-2 border-t border-white/5">
                        {/* Download Trigger Button */}
                        <Button
                            disabled={!isTimerFinished || !resolvedUrl}
                            onClick={handleDownloadClick}
                            className={`w-full font-bold h-12 flex items-center justify-center gap-2 rounded-xl transition-all duration-300 border ${
                                isTimerFinished 
                                    ? "bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer" 
                                    : "bg-[#1c1c1c] text-gray-500 border-white/5 cursor-not-allowed"
                            }`}
                        >
                            <Download className={`w-5 h-5 ${isTimerFinished ? "text-black" : "text-gray-500"}`} />
                            {isTimerFinished ? "Baixar Vídeo Agora" : `Aguarde (${countdown}s)`}
                        </Button>

                        {/* Back Button (Only if there were multiple options) */}
                        {effectiveLinks.length > 1 && (
                            <button
                                onClick={() => {
                                    setSelectedLink(null);
                                    setResolvedUrl(null);
                                    setPlaybackUrl(null);
                                    setResolveError(null);
                                    setCountdown(10);
                                    setIsTimerFinished(false);
                                    if (hlsRef.current) {
                                        hlsRef.current.destroy();
                                        hlsRef.current = null;
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors py-1.5 font-medium"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Escolher outra opção
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
