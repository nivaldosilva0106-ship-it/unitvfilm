import { Play, Info, Download } from "lucide-react";
import { Button } from "./ui/button";

interface ContentCardProps {
  title: string;
  thumbnail: string;
  onPlay?: () => void;
  onInfo?: () => void;
  onDownload?: () => void;
}

export const ContentCard = ({ title, thumbnail, onPlay, onInfo, onDownload }: ContentCardProps) => {
  return (
    <div 
      className="relative group min-w-[140px] sm:min-w-[160px] cursor-pointer card-hover focus-within:ring-2 focus-within:ring-primary rounded-lg" 
      tabIndex={0}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className="w-full h-[200px] sm:h-[240px] object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
            <div className="flex gap-1.5">
              <Button
                onClick={onPlay}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 h-8 text-xs glow-effect-hover"
              >
                <Play className="w-3 h-3 mr-1" />
                Assistir
              </Button>
              <Button
                onClick={onInfo}
                size="sm"
                variant="secondary"
                className="flex-1 h-8 text-xs"
              >
                <Info className="w-3 h-3 mr-1" />
                Info
              </Button>
            </div>
            {onDownload && (
              <Button
                onClick={onDownload}
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Baixar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
