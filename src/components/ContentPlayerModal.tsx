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
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] p-0 bg-black border-border/50 shadow-2xl [&>button]:hidden">
        
        {/* Close Button (Customizado) */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 transition-colors"
          title="Fechar Player (ESC)"
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Iframe Container (Aspect Ratio 16:9) */}
        <div className="relative w-full h-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            ref={iframeRef}
            src={videoUrl}
            title={`Player - ${title}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // O tabindex 0 é crucial para que o iframe possa ser focado
            tabIndex={0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};