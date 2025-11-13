import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrailerModal } from "@/components/TrailerModal";
import { Play, Download, Video } from "lucide-react";
import type { Episode } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

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

  const { playNavigationSound } = useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
    onArrowUp: () => setFocusedIndex(prev => Math.max(prev - 1, 0)),
    onArrowDown: () => setFocusedIndex(prev => Math.min(prev + 1, seasonEpisodes.length - 1)),
    onArrowLeft: () => {
      if (selectedSeason > seasons[0]) {
        setSelectedSeason(prev => prev - 1);
        setFocusedIndex(0);
      }
    },
    onArrowRight: () => {
      if (selectedSeason < seasons[seasons.length - 1]) {
        setSelectedSeason(prev => prev + 1);
        setFocusedIndex(0);
      }
    },
    onEnter: () => {
      if (seasonEpisodes[focusedIndex]) {
        handlePlay(seasonEpisodes[focusedIndex].url);
      }
    },
  });

  useEffect(() => {
    if (open && buttonRefs.current[focusedIndex]) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, open, selectedSeason]);


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
                      onClick={() => {
                        playNavigationSound('select');
                        handlePlay(episode.url);
                      }}
                      size="default"
                      className="bg-primary hover:bg-primary/90 h-10 px-4"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Assistir
                    </Button>
                    {episode.download_url && (
                      <Button
                        onClick={() => {
                          playNavigationSound('select');
                          handleDownload(episode.download_url);
                        }}
                        size="default"
                        variant="outline"
                        className="h-10 px-4"
                      >
                        <Download className="w-4 h-4 mr-2" />
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