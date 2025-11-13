import { Play, Info, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useRef } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

interface ContentCardProps {
  title: string;
  thumbnail: string;
  onPlay?: () => void;
  onInfo?: () => void;
  onDownload?: () => void;
}

export const ContentCard = ({ title, thumbnail, onPlay, onInfo, onDownload }: ContentCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  // Use only the sound helper, without installing key listeners
  const { playNavigationSound } = useKeyboardNavigation({ enabled: false });

  const handleButtonClick = (cb?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    playNavigationSound('select');
    cb?.();
  };

  const handleButtonFocus = () => playNavigationSound('focus');

  return (
    <div 
      ref={cardRef}
      className="relative group min-w-[140px] sm:min-w-[160px] cursor-pointer card-hover rounded-lg transition-all"
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className="w-full h-[200px] sm:h-[240px] object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-end p-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
            <div className="flex justify-center gap-2">
              <Button
                onClick={handleButtonClick(onPlay)}
                onFocus={handleButtonFocus}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8 glow-effect-hover rounded-full"
                tabIndex={0}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleButtonClick(onInfo)}
                onFocus={handleButtonFocus}
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full"
                tabIndex={0}
              >
                <Info className="w-4 h-4" />
              </Button>
              {onDownload && (
                <Button
                  onClick={handleButtonClick(onDownload)}
                  onFocus={handleButtonFocus}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  tabIndex={0}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};