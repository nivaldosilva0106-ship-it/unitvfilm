import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { useRef, useEffect } from "react";

interface ContentPlayerModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

export const ContentPlayerModal = ({ open, onClose, videoUrl, title }: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Garante que o ESC feche o modal
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  // Foca o iframe quando o modal abre para permitir controle direto do player
  useEffect(() => {
    if (open && iframeRef.current) {
      // Adiciona um pequeno delay para garantir que o modal esteja totalmente renderizado
      setTimeout(() => {
        iframeRef.current?.focus();
      }, 100);
    }
  }, [open]);

  if (!videoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-screen h-screen p-0 bg-black border-none [&>button]:hidden">
        
        {/* Close Button (Customizado) */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white bg-black/50 hover:bg-white/20 backdrop-blur-sm transition-colors rounded-full"
          title="Fechar Player (ESC)"
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Iframe Container - Fullscreen */}
        <div className="relative w-full h-full">
          <iframe
            ref={iframeRef}
            src={videoUrl}
            title={`Player - ${title}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            tabIndex={0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};