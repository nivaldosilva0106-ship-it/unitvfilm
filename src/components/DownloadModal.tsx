import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Info } from "lucide-react";

interface DownloadModalProps {
    open: boolean;
    onClose: () => void;
    downloadUrl: string;
    title: string;
}

export const DownloadModal = ({ open, onClose, downloadUrl, title }: DownloadModalProps) => {
    const handleDownload = () => {
        window.open(downloadUrl, '_blank');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl">
                <div className="p-6 pb-0">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 border-2 border-primary/20">
                        <Download className="w-8 h-8 text-primary" />
                    </div>

                    <DialogHeader className="mb-6 text-center">
                        <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                            Download via Torrent
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex gap-3 items-start">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-200/90 leading-relaxed">
                                Atenção: Este é um arquivo <strong>Torrent</strong>.
                            </p>
                        </div>

                        <div className="space-y-3 text-sm text-zinc-400">
                            <p className="leading-relaxed">
                                Para baixar o filme/série <strong>"{title}"</strong>, você precisa ter um cliente Torrent instalado no seu dispositivo (como uTorrent, BitTorrent, qBittorrent).
                            </p>

                            <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                <p>
                                    1. Certifique-se de ter o uTorrent instalado.<br />
                                    2. Clique em "Baixar Agora" para abrir o link magnet/arquivo.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 flex flex-col sm:flex-row gap-3 mt-2 bg-black/20">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full sm:w-1/2 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleDownload}
                        className="w-full sm:w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar Agora
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
