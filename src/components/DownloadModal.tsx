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
            <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-6 overflow-hidden shadow-2xl">
                {/* Download Icon */}
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20">
                    <Download className="w-8 h-8 text-primary" />
                </div>

                {/* Thumbnail */}
                {thumbnail && (
                    <div className="flex justify-center mb-4">
                        <img 
                            src={thumbnail} 
                            alt={title}
                            className="w-32 h-44 object-cover rounded-lg shadow-lg border border-border"
                        />
                    </div>
                )}

                {/* Title */}
                <h2 className="text-lg font-bold text-center mb-4">
                    Baixar Filme: {title}
                </h2>

                {/* Warning */}
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex gap-3 items-center mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                    <p className="text-sm text-yellow-200/90">
                        Atenção: Este é um arquivo <strong>Torrent</strong>.
                    </p>
                </div>

                {/* Instructions */}
                <p className="text-sm text-muted-foreground mb-3">
                    Para baixar o conteúdo, você precisa ter um cliente Torrent instalado no seu dispositivo (como uTorrent, BitTorrent, qBittorrent).
                </p>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 mb-6">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                        1. Certifique-se de ter o uTorrent instalado.<br />
                        2. Clique em "Baixar Agora" para abrir o link magnet/arquivo.
                    </p>
                </div>

                {/* Download Button */}
                <Button
                    onClick={handleDownload}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Agora
                </Button>
            </DialogContent>
        </Dialog>
    );
};
