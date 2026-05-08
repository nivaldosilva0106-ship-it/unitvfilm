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
  onPlayEpisode: (episode: Episode) => void;
  thumbnail?: string;
}

export const EpisodeSelector = ({ open, onClose, episodes, title, trailerUrl, onPlayEpisode, thumbnail }: EpisodeSelectorProps) => {
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

  const handlePlay = (episode: Episode) => {
    onPlayEpisode(episode);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] premium-scrollbar sm:rounded-2xl transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 p-4 sm:p-6">
        <DialogHeader className="border-b border-white/10 pb-4 mb-2">
          <DialogTitle className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-md">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Trailer Button */}
          {trailerUrl && (
            <div className="flex justify-start">
              <Button
                id="trailer-button"
                onClick={() => setShowTrailerModal(true)}
                variant="secondary"
                size="sm"
                tabIndex={0}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md rounded-lg shadow-xl"
              >
                <Video className="w-4 h-4 mr-2" />
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
                variant="ghost"
                onClick={() => {
                  setSelectedSeason(season);
                  setFocusedIndex(0);
                }}
                className={`min-w-[100px] h-9 rounded-full text-sm font-semibold transition-all ${selectedSeason === season ? 'bg-primary text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'}`}
                tabIndex={0}
              >
                Temporada {season}
              </Button>
            ))}
          </div>

          {/* Episodes List */}
          <div className="space-y-2">
            {seasonEpisodes.map((episode, index) => (
              <div
                key={`${episode.season}-${episode.episode}`}
                ref={(el) => (episodeRefs.current[index] = el)}
                tabIndex={0} // Torna o item da lista focável
                onFocus={() => {
                  setFocusedIndex(index);
                  playNavigationSound('focus');
                }}
                onClick={() => handlePlay(episode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePlay(episode);
                  }
                }}
                className={`group relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-xl transition-all cursor-pointer border ${focusedIndex === index ? 'bg-white/10 border-white/20 scale-[1.01]' : 'border-transparent bg-white/[0.02] hover:bg-white/5 hover:border-white/10 hover:scale-[1.01]'}`}
              >
                {/* Thumbnail / Poster */}
                {thumbnail && (
                  <div className="relative w-full sm:w-36 h-32 sm:h-24 rounded-lg overflow-hidden shrink-0 shadow-lg">
                    <img src={thumbnail} alt={episode.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 bg-primary/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 text-white fill-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-md">
                      T{episode.season}E{episode.episode}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-bold text-white text-sm sm:text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {episode.episode}. {episode.title || `Episódio ${episode.episode}`}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{title}</p>
                </div>

                <div className="flex flex-row sm:flex-col lg:flex-row gap-2 shrink-0 mt-2 sm:mt-0">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      playNavigationSound('select');
                      handlePlay(episode.url, `T${episode.season}E${episode.episode} - ${episode.title}`);
                    }}
                    size="sm"
                    className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-9 sm:h-10 px-4 rounded-lg text-xs sm:text-sm transition-transform hover:scale-105 active:scale-95"
                    tabIndex={-1}
                  >
                    <Play className="w-4 h-4 mr-1.5 fill-current" />
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
                      className="flex-1 sm:flex-none bg-black/40 hover:bg-black/60 text-white border-white/20 h-9 sm:h-10 px-4 rounded-lg text-xs sm:text-sm backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
                      tabIndex={-1}
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Baixar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 font-medium text-center border-t border-white/5 pt-4">
          Navegue com setas • Enter para abrir • ESC para fechar
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
          thumbnail={selectedDownloadEpisode.thumbnail_url || thumbnail || ""} // Use episode or series thumbnail
          contentId={selectedDownloadEpisode.id}
        />
      )}
    </Dialog>
  );
};