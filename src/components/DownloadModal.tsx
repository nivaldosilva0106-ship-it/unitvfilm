import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Info } from "lucide-react";

interface DownloadModalProps {
    open: boolean;
    onClose: () => void;
    downloadUrl: string;
    title: string;
    thumbnail?: string;
}

export const DownloadModal = ({ open, onClose, downloadUrl, title, thumbnail }: DownloadModalProps) => {
    const handleDownload = () => {
        window.open(downloadUrl, '_blank');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] bg-[#1a1a1a] border-[#333] text-white p-0 gap-0 overflow-hidden shadow-2xl">
                {/* Close button is automatically added by DialogContent */}

                <div className="flex flex-col items-center p-6 pb-2">
                    {/* Header with icon */}
                    <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-[#22c55e]/10">
                        <Download className="w-6 h-6 text-[#22c55e]" />
                    </div>

                    {/* Thumbnail */}
                    {thumbnail && (
                        <div className="mb-4 relative group">
                            <div className="absolute inset-0 bg-black/20 rounded-lg" />
                            <img
                                src={thumbnail}
                                alt={title}
                                className="w-32 h-48 object-cover rounded-lg shadow-xl"
                            />
                        </div>
                    )}

                    {/* Title */}
                    <h2 className="text-lg font-bold text-center mb-1">
                        Baixar Filme: {title}
                    </h2>
                </div>

                <div className="px-6 space-y-4 pb-6">
                    {/* Warning */}
                    <div className="p-3 rounded-lg bg-[#3a3020] border border-yellow-600/30 flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-yellow-500 font-medium">
                                Atenção: Este é um arquivo <span className="font-bold">Torrent</span>.
                            </p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-3">
                        <p className="text-sm text-gray-400 text-center px-2">
                            Para baixar o conteúdo, você precisa ter um cliente Torrent instalado no seu dispositivo (como uTorrent, BitTorrent, qBittorrent).
                        </p>

                        <div className="bg-[#262626] rounded-lg p-4 flex gap-3">
                            <Info className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" />
                            <div className="space-y-1 text-sm text-gray-300">
                                <p>1. Certifique-se de ter o uTorrent instalado.</p>
                                <p>2. Clique em "Baixar Agora" para abrir o link magnet/arquivo.</p>
                            </div>
                        </div>
                    </div>

                    {/* Download Button */}
                    <Button
                        onClick={handleDownload}
                        className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold h-12 rounded-lg text-base mt-2"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Baixar Agora
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
