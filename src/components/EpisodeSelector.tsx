import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrailerModal } from "@/components/TrailerModal";
import { Play, Download, Video } from "lucide-react";
import type { Episode } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

import { DownloadModal } from "./DownloadModal"; // Add import

interface EpisodeSelectorProps {
  open: boolean;
  onClose: () => void;
  episodes: Episode[];
  title: string;
  trailerUrl?: string;
  onPlayEpisode: (url: string, episodeTitle?: string) => void;
}

export const EpisodeSelector = ({ open, onClose, episodes, title, trailerUrl, onPlayEpisode }: EpisodeSelectorProps) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [selectedDownloadEpisode, setSelectedDownloadEpisode] = useState<Episode | null>(null); // Add State
  const episodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const seasonButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const seasons = [...new Set(episodes.map(ep => ep.season))].sort((a, b) => a - b);
  const seasonEpisodes = episodes
    .filter(ep => ep.season === selectedSeason)
    .sort((a, b) => a.episode - b.episode);

  const handlePlay = (url: string, episodeTitle?: string) => {
    onPlayEpisode(url, episodeTitle);
    onClose();
  };

  const { playNavigationSound } = useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
    onArrowUp: () => {
      // Se o foco estiver no trailer ou nos botões de temporada, não faça nada aqui.
      // Se estiver na lista de episódios, navegue.
      if (focusedIndex > 0) {
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else {
        // Tenta focar o botão de trailer ou o primeiro botão de temporada
        if (trailerUrl) {
          document.getElementById('trailer-button')?.focus();
        } else if (seasonButtonRefs.current[0]) {
          seasonButtonRefs.current[0].focus();
        }
      }
    },
    onArrowDown: () => {
      setFocusedIndex(prev => Math.min(prev + 1, seasonEpisodes.length - 1));
    },
    onArrowLeft: () => {
      const currentSeasonIndex = seasons.indexOf(selectedSeason);
      if (currentSeasonIndex > 0) {
        setSelectedSeason(seasons[currentSeasonIndex - 1]);
        setFocusedIndex(0);
      }
    },
    onArrowRight: () => {
      const currentSeasonIndex = seasons.indexOf(selectedSeason);
      if (currentSeasonIndex < seasons.length - 1) {
        setSelectedSeason(seasons[currentSeasonIndex + 1]);
        setFocusedIndex(0);
      }
    },
    onEnter: () => {
      if (seasonEpisodes[focusedIndex]) {
        const ep = seasonEpisodes[focusedIndex];
        handlePlay(ep.url, `T${ep.season}E${ep.episode} - ${ep.title}`);
      }
    },
  });

  useEffect(() => {
    // Garante que o foco visual siga o focusedIndex
    if (open && episodeRefs.current[focusedIndex]) {
      episodeRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, open, selectedSeason]);

  useEffect(() => {
    // Quando o modal abre, tenta focar o primeiro elemento interativo
    if (open) {
      // Resetar o foco visual para o primeiro episódio da temporada selecionada
      setFocusedIndex(0);
      setTimeout(() => {
        if (trailerUrl) {
          document.getElementById('trailer-button')?.focus();
        } else if (seasonButtonRefs.current[0]) {
          seasonButtonRefs.current[0].focus();
        } else if (episodeRefs.current[0]) {
          episodeRefs.current[0].focus();
        }
      }, 100);
    }
  }, [open, trailerUrl]);


  const handleDownload = (episode: Episode) => {
    if (episode.downloads?.length || episode.download_url) {
      setSelectedDownloadEpisode(episode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border premium-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trailer Button */}
          {trailerUrl && (
            <div className="flex justify-center">
              <Button
                id="trailer-button"
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
            {seasons.map((season, index) => (
              <Button
                key={season}
                ref={(el) => (seasonButtonRefs.current[index] = el)}
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
                ref={(el) => (episodeRefs.current[index] = el)}
                tabIndex={0} // Torna o item da lista focável
                onFocus={() => {
                  setFocusedIndex(index);
                  playNavigationSound('focus');
                }}
                onClick={() => handlePlay(episode.url, `T${episode.season}E${episode.episode} - ${episode.title}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePlay(episode.url, `T${episode.season}E${episode.episode} - ${episode.title}`);
                  }
                }}
                className={`p-4 bg-secondary rounded-lg transition-all cursor-pointer ${focusedIndex === index ? 'ring-2 ring-primary glow-effect' : 'hover:bg-secondary/80'
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
                      onClick={(e) => {
                        e.stopPropagation();
                        playNavigationSound('select');
                        handlePlay(episode.url, `T${episode.season}E${episode.episode} - ${episode.title}`);
                      }}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 h-8 px-3"
                      tabIndex={-1} // Evita que o botão dentro do item focável seja focado separadamente
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Assistir
                    </Button>
                    {/* Download Button */}
                    {(episode.download_url || (episode.downloads && episode.downloads.length > 0)) && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          playNavigationSound('select');
                          handleDownload(episode);
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        tabIndex={-1} // Evita que o botão dentro do item focável seja focado separadamente
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

      {/* Download Modal - Same system as Movies */}
      {selectedDownloadEpisode && (
        <DownloadModal
          open={!!selectedDownloadEpisode}
          onClose={() => setSelectedDownloadEpisode(null)}
          downloadUrl={selectedDownloadEpisode.download_url || ''}
          downloads={selectedDownloadEpisode.downloads}
          download_mode={selectedDownloadEpisode.download_mode}
          title={`${title} - S${selectedDownloadEpisode.season}E${selectedDownloadEpisode.episode}: ${selectedDownloadEpisode.title}`}
          thumbnail="" // Could pass series thumbnail if available
          contentId={selectedDownloadEpisode.id}
        />
      )}
    </Dialog>
  );
};