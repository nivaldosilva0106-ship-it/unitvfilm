import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

interface IframeModalProps {
  open: boolean;
  onClose: () => void;
  iframeUrl: string;
  title: string;
}

export const IframeModal = ({ open, onClose, iframeUrl, title }: IframeModalProps) => {
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  if (!iframeUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-black border-border [&>button]:hidden">
        <DialogHeader className="p-4 bg-card/80 absolute top-0 left-0 right-0 z-10">
          <DialogTitle className="text-foreground truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full" style={{ paddingBottom: '56.25%', marginTop: '60px' }}>
          <iframe
            src={iframeUrl}
            title={`Stream - ${title}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};