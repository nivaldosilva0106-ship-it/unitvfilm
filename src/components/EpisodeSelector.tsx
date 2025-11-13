import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrailerModal } from "@/components/TrailerModal";
import { Play, Download, X, Video } from "lucide-react";
import type { Episode } from "@/types/content";

interface EpisodeSelectorProps {
  open: boolean;
  onClose: () => void;
  episodes: Episode[];
  title: string;
  trailerUrl?: string;
}

export const EpisodeSelector = ({ open, onClose, episodes, title, trailerUrl }: EpisodeSelectorProps) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const seasons = [...new Set(episodes.map(ep => ep.season))].sort((a, b) => a - b);
  const seasonEpisodes = episodes
    .filter(ep => ep.season === selectedSeason)
    .sort((a, b) => a.episode - b.episode);

  useEffect(() => {
    if (open && buttonRefs.current[focusedIndex]) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, open, selectedSeason]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, seasonEpisodes.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedSeason > seasons[0]) {
            setSelectedSeason(prev => prev - 1);
            setFocusedIndex(0);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedSeason < seasons[seasons.length - 1]) {
            setSelectedSeason(prev => prev + 1);
            setFocusedIndex(0);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedSeason, seasons, seasonEpisodes.length, onClose]);

  const handlePlay = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDownload = (url?: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">{title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trailer Button */}
          {trailerUrl && (
            <div className="flex justify-center">
              <Button
                onClick={() => setShowTrailerModal(true)}
                variant="secondary"
                size="lg"
                tabIndex={0}
                className="glow-effect-hover"
              >
                <Video className="w-5 h-5 mr-2" />
                Assistir Trailer
              </Button>
            </div>
          )}

          {/* Season Selector */}
          <div className="flex gap-2 flex-wrap">
            {seasons.map((season) => (
              <Button
                key={season}
                variant={selectedSeason === season ? "default" : "outline"}
                onClick={() => {
                  setSelectedSeason(season);
                  setFocusedIndex(0);
                }}
                className="min-w-[100px]"
                tabIndex={0}
              >
                Temporada {season}
              </Button>
            ))}
          </div>

          {/* Episodes List */}
          <div className="space-y-3">
            {seasonEpisodes.map((episode, index) => (
              <div
                key={`${episode.season}-${episode.episode}`}
                className={`p-4 bg-secondary rounded-lg transition-all ${
                  focusedIndex === index ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      T{episode.season}E{episode.episode} - {episode.title}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      ref={(el) => (buttonRefs.current[index] = el)}
                      onClick={() => handlePlay(episode.url)}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Assistir
                    </Button>
                    {episode.download_url && (
                      <Button
                        onClick={() => handleDownload(episode.download_url)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground text-center">
          Use as setas do teclado/controle para navegar • Enter para selecionar • ESC para fechar
        </div>
      </DialogContent>

      {/* Trailer Modal */}
      {showTrailerModal && trailerUrl && (
        <TrailerModal
          open={showTrailerModal}
          onClose={() => setShowTrailerModal(false)}
          trailerUrl={trailerUrl}
          title={title}
        />
      )}
    </Dialog>
  );
};