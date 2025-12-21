import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
  trailerUrl: string;
  title: string;
}

import { useContentProtection } from "@/hooks/useContentProtection";

export const TrailerModal = ({ open, onClose, trailerUrl, title }: TrailerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useContentProtection(open);

  // Extract YouTube video ID from URL
  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : "";
  };

  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  // Foca o iframe quando o modal abre
  useEffect(() => {
    if (open && iframeRef.current) {
      setTimeout(() => {
        iframeRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const embedUrl = getYoutubeEmbedUrl(trailerUrl);

  if (!embedUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-black border-border [&>button]:hidden">

        {/* Close Button (Customizado) */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 transition-colors"
          title="Fechar Trailer (ESC)"
        >
          <X className="w-6 h-6" />
        </Button>

        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`Trailer - ${title}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            tabIndex={0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};