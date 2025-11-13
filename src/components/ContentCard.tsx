import { Play, Info, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

interface ContentCardProps {
  title: string;
  thumbnail: string;
  onPlay?: () => void;
  onInfo?: () => void;
  onDownload?: () => void;
}

export const ContentCard = ({ title, thumbnail, onPlay, onInfo, onDownload }: ContentCardProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { playNavigationSound } = useKeyboardNavigation({
    enabled: isFocused,
    onEnter: () => onPlay?.(),
  });

  useEffect(() => {
    const handleFocus = () => {
      setIsFocused(true);
      playNavigationSound('focus');
    };
    const handleBlur = () => setIsFocused(false);

    const card = cardRef.current;
    if (card) {
      card.addEventListener('focus', handleFocus);
      card.addEventListener('blur', handleBlur);
      return () => {
        card.removeEventListener('focus', handleFocus);
        card.removeEventListener('blur', handleBlur);
      };
    }
  }, [playNavigationSound]);

  return (
    <div 
      ref={cardRef}
      className={`relative group min-w-[140px] sm:min-w-[160px] cursor-pointer card-hover rounded-lg transition-all ${
        isFocused ? 'ring-2 ring-primary scale-105' : ''
      }`}
      tabIndex={0}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className="w-full h-[200px] sm:h-[240px] object-cover"
          loading="lazy"
        />
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-end p-3 ${
          isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
            <div className="flex justify-center gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  playNavigationSound('select');
                  onPlay?.();
                }}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8 glow-effect-hover rounded-full"
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  playNavigationSound('select');
                  onInfo?.();
                }}
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full"
              >
                <Info className="w-4 h-4" />
              </Button>
              {onDownload && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    playNavigationSound('select');
                    onDownload?.();
                  }}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
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