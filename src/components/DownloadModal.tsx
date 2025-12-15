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
            <DialogContent className="sm:max-w-sm bg-background border-border text-foreground p-4 overflow-hidden shadow-2xl">
                {/* Header with icon */}
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20">
                    <Download className="w-6 h-6 text-primary" />
                </div>

                {/* Thumbnail */}
                {thumbnail && (
                    <div className="flex justify-center mb-3">
                        <img 
                            src={thumbnail} 
                            alt={title}
                            className="w-24 h-36 object-cover rounded-md shadow-lg border border-border"
                        />
                    </div>
                )}

                {/* Title */}
                <h2 className="text-base font-bold text-center mb-3">
                    Baixar: {title}
                </h2>

                {/* Warning */}
                <div className="p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 flex gap-2 items-center mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                    <p className="text-xs text-yellow-200/90">
                        Atenção: Este é um arquivo <strong>Torrent</strong>.
                    </p>
                </div>

                {/* Instructions */}
                <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 mb-3">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                        Tenha um cliente Torrent instalado (uTorrent, qBittorrent).
                    </p>
                </div>

                {/* Download Button */}
                <Button
                    onClick={handleDownload}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Agora
                </Button>
            </DialogContent>
        </Dialog>
    );
};
