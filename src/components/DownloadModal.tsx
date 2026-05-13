import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Info, Loader2, Copy } from "lucide-react";
import { useState, useEffect } from "react";

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

import { addTransfer } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { createSecureDownloadUrl, createSecurePlaybackUrl, isProtectedUrl } from "@/lib/secure-url";

import { toast } from "sonner";

export const DownloadModal = ({ open, onClose, downloadUrl, downloads, download_mode = 'direct', title, thumbnail, contentId }: DownloadModalProps) => {
    const { user } = useAuth();
    const [pendingUrl, setPendingUrl] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number>(10);
    const [isStreamingLink, setIsStreamingLink] = useState(false);
    const [originalUrlForCopy, setOriginalUrlForCopy] = useState<string>("");

    // Determine effective links. If no new 'downloads', use legacy 'downloadUrl' as single link.
    const rawLinks = (downloads && downloads.length > 0)
        ? downloads
        : (downloadUrl ? [{ label: 'Download Principal', url: downloadUrl, type: download_mode === 'torrent' ? 'torrent' : 'direct' as const }] : []);

    const effectiveLinks = rawLinks.map(link => {
        // Protect direct downloads
        if (link.type !== 'torrent' && isProtectedUrl(link.url)) {
            return {
                ...link,
                url: createSecureDownloadUrl(link.url, `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}`),
                originalUrl: link.url
            };
        }
        return { ...link, originalUrl: link.url };
    });

    const showTorrentWarning = download_mode === 'torrent' || (download_mode === 'mixed' && effectiveLinks.some(l => l.type === 'torrent'));

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (pendingUrl && countdown > 0 && !isStreamingLink) {
            timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
        } else if (pendingUrl && countdown === 0 && !isStreamingLink) {
            window.open(pendingUrl, '_blank');
            onClose();
            setPendingUrl(null);
        }
        return () => clearTimeout(timer);
    }, [pendingUrl, countdown, isStreamingLink, onClose]);

    // Reset state when modal closes/opens
    useEffect(() => {
        if (!open) {
            setPendingUrl(null);
            setCountdown(10);
            setIsStreamingLink(false);
        }
    }, [open]);

    const handleDownload = async (url: string, originalUrl: string) => {
        setPendingUrl(url);
        setOriginalUrlForCopy(originalUrl);
        
        // Check if it's an HLS streaming link (m3u8, txt masquerading as m3u8)
        const lowerOriginal = originalUrl.toLowerCase().split('?')[0];
        const isHls = lowerOriginal.endsWith('.m3u8') || lowerOriginal.endsWith('.txt') || lowerOriginal.endsWith('.m3u') || originalUrl.includes('typezero.top/pl/');
        
        setIsStreamingLink(isHls);
        setCountdown(10);
        
        // Track the download in Firebase
        if (user) {
            try {
                await addTransfer(user.uid, {
                    contentId,
                    title,
                    thumbnailUrl: thumbnail,
                    url
                });
            } catch (error) {
                console.error("Error tracking transfer:", error);
            }
        }
    };
    
    const copyToClipboard = () => {
        // If it's a streaming link, give them the direct proxy URL instead of the secure-download redirect
        // This ensures VLC, 1DM, IDM, etc. can process it directly without struggling with 302 redirects.
        const pathToCopy = isStreamingLink 
            ? createSecurePlaybackUrl(originalUrlForCopy) 
            : pendingUrl;
            
        const urlToCopy = window.location.origin + pathToCopy;
        
        navigator.clipboard.writeText(urlToCopy).then(() => {
            toast.success("Link copiado! Cole no seu gestor de downloads (ex: 1DM, ADM).");
        }).catch(() => {
            // Fallback for some browsers
            navigator.clipboard.writeText(originalUrlForCopy).then(() => {
                toast.success("Link copiado!");
            });
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] bg-[#1a1a1a] border-[#333] text-white p-0 gap-0 overflow-hidden shadow-2xl flex flex-col justify-center items-center">
                <div className="flex flex-col items-center w-full p-6 pb-2">
                    <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-[#22c55e]/10">
                        <Download className="w-6 h-6 text-[#22c55e]" />
                    </div>

                    {thumbnail && !pendingUrl && (
                        <div className="mb-4 relative group">
                            <div className="absolute inset-0 bg-black/20 rounded-lg" />
                            <img src={thumbnail} alt={title} className="w-32 h-48 object-cover rounded-lg shadow-xl" />
                        </div>
                    )}

                    <h2 className="text-lg font-bold text-center mb-1">
                        {pendingUrl ? 'Preparando Download' : `Baixar: ${title}`}
                    </h2>
                </div>

                <div className="w-full px-6 space-y-4 pb-6">
                    {pendingUrl ? (
                        <div className="flex flex-col flex-1 items-center justify-center py-6 animate-in fade-in zoom-in-95 duration-500">
                            {isStreamingLink ? (
                                <>
                                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col gap-4 mb-6 w-full">
                                        <div className="flex gap-3 items-start">
                                            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                            <div className="space-y-2 text-left">
                                                <p className="text-sm text-blue-200 font-bold">Formato de Streaming (Playlist)</p>
                                                <p className="text-xs text-gray-300">
                                                    Este link não baixa diretamente no navegador. Para baixar o filme completo, use um gestor de downloads.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mt-2">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Apps Recomendados:</p>
                                            
                                            <div className="grid grid-cols-1 gap-2">
                                                {/* 1DM */}
                                                <a 
                                                    href="https://play.google.com/store/apps/details?id=idm.internet.download.manager&hl=pt" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 hover:bg-black/60 transition-colors group"
                                                >
                                                    <img src="/1dm_icon.png" className="w-8 h-8 rounded object-contain" alt="1DM" />
                                                    <div className="flex-1">
                                                        <p className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors">1DM (Android)</p>
                                                        <p className="text-[9px] text-gray-500">Ideal para .m3u8 e .ts</p>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                                </a>

                                                {/* ADM */}
                                                <a 
                                                    href="https://play.google.com/store/apps/details?id=com.dv.adm&hl=pt" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 hover:bg-black/60 transition-colors group"
                                                >
                                                    <img src="/adm_icon.png" className="w-8 h-8 rounded object-contain" alt="ADM" />
                                                    <div className="flex-1">
                                                        <p className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors">ADM (Android)</p>
                                                        <p className="text-[9px] text-gray-500">Rápido e multitarefa</p>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                                </a>

                                                {/* IDM PC */}
                                                <a 
                                                    href="https://www.internetdownloadmanager.com" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 hover:bg-black/60 transition-colors group"
                                                >
                                                    <img src="/idm_pc_icon.png" className="w-8 h-8 rounded object-contain" alt="IDM PC" />
                                                    <div className="flex-1">
                                                        <p className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors">Internet Download Manager (PC)</p>
                                                        <p className="text-[9px] text-gray-500">Versão para Computador</p>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={copyToClipboard}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 flex items-center justify-center gap-2 mb-3"
                                    >
                                        <Copy className="w-5 h-5" />
                                        COPIAR LINK PARA DOWNLOAD
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingUrl(null);
                                            setIsStreamingLink(false);
                                        }}
                                        className="w-full text-gray-400 border-gray-700 hover:bg-gray-800"
                                    >
                                        Voltar
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="relative w-24 h-24 mb-6">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r="45"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="transparent"
                                                className="text-gray-800"
                                            />
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r="45"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="transparent"
                                                strokeDasharray="282.7"
                                                strokeDashoffset={282.7 - (282.7 * countdown) / 10}
                                                className="text-[#22c55e] transition-all duration-1000 ease-linear"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-3xl font-black text-white">{countdown}s</span>
                                        </div>
                                    </div>
                                    <h3 className="text-[#22c55e] font-bold text-lg mb-2 text-center animate-pulse">
                                        Aguarde, vamos redirecionar você...
                                    </h3>
                                    <p className="text-gray-400 text-sm text-center">
                                        O link do download abrirá automaticamente em uma nova aba em {countdown} segundos.
                                    </p>
                                    <Button
                                        onClick={() => {
                                            window.open(pendingUrl, '_blank');
                                            onClose();
                                            setPendingUrl(null);
                                        }}
                                        className="mt-6 bg-[#22c55e] hover:bg-[#22c55e]/80 text-black font-bold w-full uppercase"
                                    >
                                        Clique aqui se demorar
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                            {showTorrentWarning && (
                                <div className="p-3 rounded-lg bg-[#3a3020] border border-yellow-600/30">
                                    <div className="flex gap-3 items-start mb-2">
                                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-sm text-yellow-500 font-medium">
                                                {download_mode === 'mixed' ? 'Alguns arquivos requerem cliente Torrent.' : 'Atenção: Arquivo Torrent.'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 px-1">
                                        Para baixar links do tipo Torrent, você precisa de um cliente como uTorrent.
                                    </p>
                                </div>
                            )}

                            {!showTorrentWarning && download_mode === 'direct' && (
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex gap-3 items-center">
                                    <Info className="w-5 h-5 text-green-500 shrink-0" />
                                    <p className="text-sm text-green-200">Escolha uma das opções abaixo para baixar.</p>
                                </div>
                            )}

                            <div className="grid gap-3">
                                {effectiveLinks.map((link, idx) => (
                                    <Button
                                        key={idx}
                                        onClick={() => handleDownload(link.url, link.originalUrl || link.url)}
                                        className="w-full bg-[#262626] hover:bg-[#333] text-white border border-white/10 h-auto py-3 px-4 flex items-center justify-between group"
                                    >
                                        <div className="flex flex-col items-start text-left">
                                            <span className="font-bold group-hover:text-[#22c55e] transition-colors line-clamp-1">{link.label || 'Download'}</span>
                                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">
                                                {link.type || (download_mode === 'torrent' ? 'Torrent' : 'Direto')}
                                            </span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#22c55e]/20 transition-colors shrink-0 ml-2">
                                            <Download className="w-4 h-4 text-gray-400 group-hover:text-[#22c55e]" />
                                        </div>
                                    </Button>
                                ))}
                                {effectiveLinks.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">Nenhum link disponível.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
