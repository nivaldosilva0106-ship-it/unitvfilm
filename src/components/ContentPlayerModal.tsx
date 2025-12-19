import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Play } from "lucide-react";
import { Content, Episode } from "@/types/content";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ContentPlayerModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  videoUrls?: string[];
  title: string;
  posterUrl?: string;
  image?: string;
  description?: string;
  rating?: string | number;
  episodeTitle?: string;
  internalPlayerUrl?: string;
  isPremium?: boolean;
  suggestions?: Content[];
  episodes?: Episode[];
  currentSeason?: number;
  currentEpisode?: number;
  onPlayContent?: (content: Content) => void;
  onPlayNext?: (episode: Episode) => void;
  onAddToMyList?: (content: Content) => void;
}

export const ContentPlayerModal = ({
  open,
  onClose,
  videoUrl,
  videoUrls,
  title,
  posterUrl,
  image,
  description,
  rating,
  episodeTitle,
  internalPlayerUrl,
  isPremium,
  suggestions = [],
  episodes = [],
  currentSeason,
  currentEpisode,
  onPlayContent,
  onPlayNext,
  onAddToMyList,
}: ContentPlayerModalProps) => {
  const navigate = useNavigate();
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Find next episode
  const getNextEpisode = (): Episode | null => {
    if (!episodes || episodes.length === 0 || currentSeason === undefined || currentEpisode === undefined) {
      return null;
    }

    // Sort episodes by season and episode number
    const sortedEpisodes = [...episodes].sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });

    // Find current episode index
    const currentIndex = sortedEpisodes.findIndex(
      (ep) => ep.season === currentSeason && ep.episode === currentEpisode
    );

    // Return next episode if exists
    if (currentIndex !== -1 && currentIndex < sortedEpisodes.length - 1) {
      return sortedEpisodes[currentIndex + 1];
    }

    return null;
  };

  const nextEpisode = getNextEpisode();

  const handlePlayNext = () => {
    if (nextEpisode && onPlayNext) {
      onPlayNext(nextEpisode);
    }
  };

  // Determine which URL to use
  const playerUrl = internalPlayerUrl || videoUrl;
  const useEmbed = !!internalPlayerUrl;

  useEffect(() => {
    if (!open) {
      setShowSuggestions(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-background border-border overflow-hidden [&>button]:hidden">
        {/* Close Button */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-foreground hover:bg-muted transition-colors"
          title="Fechar (ESC)"
        >
          <X className="w-6 h-6" />
        </Button>

        <div className="flex flex-col lg:flex-row h-full max-h-[95vh]">
          {/* Player Section */}
          <div className="flex-1 flex flex-col">
            {/* Video Player */}
            <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
              {useEmbed ? (
                <iframe
                  src={playerUrl}
                  title={title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video
                  src={playerUrl}
                  title={title}
                  className="absolute inset-0 w-full h-full"
                  controls
                  autoPlay
                />
              )}
            </div>

            {/* Content Info */}
            <div className="p-4 bg-card">
              <h2 className="text-xl font-bold text-foreground mb-1">{title}</h2>
              {episodeTitle && (
                <p className="text-sm text-muted-foreground mb-2">{episodeTitle}</p>
              )}
              {rating && (
                <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary rounded mb-2">
                  {rating}
                </span>
              )}
              {description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
              )}
            </div>

            {/* Next Episode Card */}
            {nextEpisode && (
              <div className="p-4 bg-card border-t border-border">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Próximo Episódio</h3>
                <button
                  onClick={handlePlayNext}
                  className="w-full flex items-center gap-4 p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors group"
                >
                  <div className="relative w-24 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={nextEpisode.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">
                      T{nextEpisode.season} E{nextEpisode.episode}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {nextEpisode.title}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </div>
            )}
          </div>

          {/* Suggestions Sidebar */}
          {suggestions.length > 0 && (
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto max-h-64 lg:max-h-none">
              <div className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Sugestões</h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  {suggestions.slice(0, 6).map((content) => (
                    <button
                      key={content.id}
                      onClick={() => onPlayContent?.(content)}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors group text-left"
                    >
                      <div className="relative w-16 h-24 lg:w-20 lg:h-28 bg-muted rounded overflow-hidden flex-shrink-0">
                        {content.thumbnail_url ? (
                          <img
                            src={content.thumbnail_url}
                            alt={content.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {content.title}
                        </p>
                        {content.year && (
                          <p className="text-xs text-muted-foreground mt-1">{content.year}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
