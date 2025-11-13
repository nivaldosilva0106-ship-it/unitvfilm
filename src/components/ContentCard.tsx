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
      className="relative group min-w-[200px] sm:min-w-[250px] cursor-pointer card-hover focus-within:ring-2 focus-within:ring-primary rounded-lg" 
      tabIndex={0}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className="w-full h-[300px] sm:h-[350px] object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold mb-2 line-clamp-2">{title}</h3>
            <div className="flex gap-2">
              <Button
                onClick={onPlay}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 glow-effect-hover"
              >
                <Play className="w-4 h-4 mr-1" />
                Assistir
              </Button>
              <Button
                onClick={onInfo}
                size="sm"
                variant="secondary"
                className="flex-1"
              >
                <Info className="w-4 h-4 mr-1" />
                Info
              </Button>
            </div>
            {onDownload && (
              <Button
                onClick={onDownload}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground/80 line-clamp-1">{title}</p>
    </div>
  );
};
