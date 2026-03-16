import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Info } from "lucide-react";

interface DownloadModalProps {
    open: boolean;
    onClose: () => void;
    downloadUrl: string; // Legacy support
    downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[];
    download_mode?: 'direct' | 'torrent' | 'mixed';
    title: string;
    thumbnail?: string;
}

export const DownloadModal = ({ open, onClose, downloadUrl, downloads, download_mode = 'direct', title, thumbnail }: DownloadModalProps) => {
    const handleDownload = (url: string) => {
        window.open(url, '_blank');
        // onClose(); // Keep open for multiple downloads? Or close. Better keep open if mixed.
    };

    // Determine effective links. If no new 'downloads', use legacy 'downloadUrl' as single link.
    const effectiveLinks = (downloads && downloads.length > 0)
        ? downloads
        : (downloadUrl ? [{ label: 'Download Principal', url: downloadUrl, type: download_mode === 'torrent' ? 'torrent' : 'direct' }] : []);

    // Determine if we should show Torrent Warning
    const showTorrentWarning = download_mode === 'torrent' || (download_mode === 'mixed' && effectiveLinks.some(l => l.type === 'torrent'));

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1a1a] border-[#333] text-white p-0 gap-0 overflow-hidden shadow-2xl">
                <div className="flex flex-col items-center p-6 pb-2">
                    <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-[#22c55e]/10">
                        <Download className="w-6 h-6 text-[#22c55e]" />
                    </div>

                    {thumbnail && (
                        <div className="mb-4 relative group">
                            <div className="absolute inset-0 bg-black/20 rounded-lg" />
                            <img src={thumbnail} alt={title} className="w-32 h-48 object-cover rounded-lg shadow-xl" />
                        </div>
                    )}

                    <h2 className="text-lg font-bold text-center mb-1">Baixar: {title}</h2>
                </div>

                <div className="px-6 space-y-4 pb-6">
                    {/* Torrent Warning - Only show if mode is torrent or mixed with torrent links */}
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
                                Para baixar links do tipo Torrent, você precisa de um cliente como uTorrent ou BitTorrent.
                            </p>
                        </div>
                    )}

                    {!showTorrentWarning && download_mode === 'direct' && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex gap-3 items-center">
                            <Info className="w-5 h-5 text-green-500 shrink-0" />
                            <p className="text-sm text-green-200">Download direto disponível. Clique para baixar.</p>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {effectiveLinks.map((link, idx) => (
                            <Button
                                key={idx}
                                onClick={() => handleDownload(link.url)}
                                className="w-full bg-[#262626] hover:bg-[#333] text-white border border-white/10 h-auto py-3 px-4 flex items-center justify-between group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-medium group-hover:text-[#22c55e] transition-colors">{link.label || 'Download'}</span>
                                    <span className="text-[10px] text-gray-500 uppercase">{link.type || (download_mode === 'torrent' ? 'Torrent' : 'Direto')}</span>
                                </div>
                                <Download className="w-4 h-4 text-gray-400 group-hover:text-white" />
                            </Button>
                        ))}
                        {effectiveLinks.length === 0 && (
                            <p className="text-center text-gray-500 py-4">Nenhum link disponível.</p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
