import React, { useState } from 'react';
import { ContentCard } from './ContentCard';
import { useLocalLibrary } from '@/hooks/useLocalLibrary';
import { FolderPlus, RefreshCw, Library, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { getImageUrl } from '@/lib/tmdb';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import { FOCUSABLE_CLASS } from '@/hooks/useSpatialNavigation';

interface LocalContentSectionProps {
  fullPage?: boolean; // When true, renders as a full-page offline view
}

type LocalGroup = {
  id: string;
  type: 'movie' | 'series';
  title: string;
  posterPath?: string;
  items: LocalMovie[];
  folderPath: string;
};

export const LocalContentSection = ({ fullPage = false }: LocalContentSectionProps) => {
  const navigate = useNavigate();
  const { localMovies, isScanning, addFolder, scanLibrary, removeMovie } = useLocalLibrary();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<LocalGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<LocalGroup | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollRow = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = window.innerWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await db.movies.clear();
      await db.folders.clear();
      toast.success('Biblioteca local limpa com sucesso!');
      setShowConfirmClear(false);
      window.location.reload();
    } catch (e) {
      toast.error('Erro ao limpar biblioteca.');
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      for (const item of itemToDelete.items) {
        if (item.id) await removeMovie(item.id);
      }
      toast.success(`${itemToDelete.type === 'series' ? 'Série' : 'Filme'} removido da biblioteca.`);
      setItemToDelete(null);
    } catch (e) {
      toast.error('Erro ao remover item.');
    }
  };

  // Grouping Logic
  const groups = localMovies.reduce((acc: LocalGroup[], movie) => {
    if (movie.type === 'episode' && movie.seriesName) {
      const existing = acc.find(g => g.type === 'series' && g.title === movie.seriesName);
      if (existing) {
        existing.items.push(movie);
        return acc;
      }
      acc.push({
        id: `series-${movie.seriesName}`,
        type: 'series',
        title: movie.seriesName,
        posterPath: movie.posterPath,
        items: [movie],
        folderPath: movie.folderPath
      });
    } else {
      // Treat as individual movie
      acc.push({
        id: `movie-${movie.id}`,
        type: 'movie',
        title: movie.title,
        posterPath: movie.posterPath,
        items: [movie],
        folderPath: movie.folderPath
      });
    }
    return acc;
  }, []);

  // Sort episodes within series
  groups.forEach(g => {
    if (g.type === 'series') {
      g.items.sort((a, b) => {
        if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
        return (a.episode || 0) - (b.episode || 0);
      });
    }
  });

  if (localMovies.length === 0 && !isScanning) {
    return (
      <div className={`${fullPage ? 'flex-1 flex flex-col items-center justify-center px-4' : 'mb-12 px-4 sm:px-8'}`}>
        <div className={`${fullPage ? '' : 'flex items-center gap-3 mb-6'}`}>
          {!fullPage && (
            <>
              <Library className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">Biblioteca Local</h2>
            </>
          )}
        </div>
        <div className={`flex flex-col items-center justify-center py-12 px-6 rounded-3xl border-2 border-dashed border-zinc-800 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer w-full max-w-lg ${FOCUSABLE_CLASS}`} tabIndex={0} onClick={addFolder}>
          <div className="bg-primary/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
             <FolderPlus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {fullPage ? 'Adicione conteúdo offline' : 'Sua biblioteca está vazia'}
          </h3>
          <p className="text-zinc-400 text-sm text-center max-w-md mb-6">
            {fullPage
              ? 'Você está offline. Adicione uma pasta com filmes ou séries do seu dispositivo para assistir sem internet.'
              : 'Adicione uma pasta do seu computador ou celular para indexar seus filmes e séries locais com pôsteres e informações do TMDB.'
            }
          </p>
          <Button onClick={(e) => { e.stopPropagation(); addFolder(); }} className={`rounded-full px-8 ${FOCUSABLE_CLASS}`} tabIndex={0}>
            Adicionar Pasta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={fullPage ? 'flex-1' : 'mb-12'}>
      <div className="flex items-center justify-between mb-6 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">Biblioteca Local</h2>
          {isScanning && <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />}
        </div>
        <div className="flex gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={scanLibrary} disabled={isScanning} className={`text-zinc-400 hover:text-white px-2 sm:px-3 ${FOCUSABLE_CLASS}`} tabIndex={0}>
             <RefreshCw className={`w-4 h-4 sm:mr-2 ${isScanning ? 'animate-spin' : ''}`} />
             <span className="hidden sm:inline">Sincronizar</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={addFolder} className={`text-zinc-400 hover:text-white px-2 sm:px-3 ${FOCUSABLE_CLASS}`} tabIndex={0}>
             <FolderPlus className="w-4 h-4 sm:mr-2" />
             <span className="hidden sm:inline">Nova Pasta</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowConfirmClear(true)} className={`text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 sm:px-3 ${FOCUSABLE_CLASS}`} tabIndex={0}>
             <Trash2 className="w-4 h-4 sm:mr-2" />
             <span className="hidden sm:inline">Limpar</span>
          </Button>
        </div>
      </div>

      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowConfirmClear(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Limpar Biblioteca?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Todos os filmes indexados e pastas serão removidos. Os arquivos originais no seu dispositivo não serão afetados.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={() => setShowConfirmClear(false)} className={`text-zinc-400 ${FOCUSABLE_CLASS}`} tabIndex={0}>
                Cancelar
              </Button>
              <Button onClick={handleClearAll} className={`bg-red-600 hover:bg-red-500 text-white ${FOCUSABLE_CLASS}`} tabIndex={0}>
                Limpar Tudo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Item Delete Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Remover da Biblioteca?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Deseja remover "{itemToDelete.title}"? Os arquivos no seu dispositivo não serão excluídos.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={() => setItemToDelete(null)} className={`text-zinc-400 ${FOCUSABLE_CLASS}`} tabIndex={0}>
                Cancelar
              </Button>
              <Button onClick={handleDeleteItem} className={`bg-red-600 hover:bg-red-500 text-white ${FOCUSABLE_CLASS}`} tabIndex={0}>
                Remover
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Episode Selector Dialog */}
      {selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setSelectedGroup(null)}>
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedGroup.title}</h3>
                <p className="text-zinc-500 text-sm italic">{selectedGroup.items.length} episódios encontrados</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className={`rounded-full ${FOCUSABLE_CLASS}`} tabIndex={0}>
                <Library className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
              {selectedGroup.items.map((episode) => (
                <div 
                  key={episode.id}
                  onClick={() => {
                    navigate(`/watch-local/${episode.id}`);
                    setSelectedGroup(null);
                  }}
                  className={`flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-primary/30 transition-all cursor-pointer group ${FOCUSABLE_CLASS}`}
                  tabIndex={0}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-primary group-hover:scale-110 transition-transform">
                    {episode.season && episode.episode ? `${episode.season}x${episode.episode.toString().padStart(2, '0')}` : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{episode.fileName}</p>
                    <p className="text-zinc-500 text-xs truncate italic">{episode.filePath}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative group/row">
        {/* Navigation Arrows */}
        {!fullPage && (
          <>
            <button 
              onClick={() => scrollRow('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-[240px] w-12 flex items-center justify-center bg-gradient-to-r from-background to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer text-white"
            >
              <div className={`bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors ${FOCUSABLE_CLASS}`} tabIndex={0}>
                <ChevronLeft className="w-6 h-6" />
              </div>
            </button>
            <button 
              onClick={() => scrollRow('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-[240px] w-12 flex items-center justify-center bg-gradient-to-l from-background to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer text-white"
            >
              <div className={`bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors ${FOCUSABLE_CLASS}`} tabIndex={0}>
                <ChevronRight className="w-6 h-6" />
              </div>
            </button>
          </>
        )}

        <div 
          ref={scrollContainerRef}
          className={`flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 pb-4 scroll-smooth ${fullPage ? 'flex-wrap justify-center sm:justify-start' : ''}`}
        >
          {groups.map((group) => (
            <div key={group.id} className="relative group/card">
              <ContentCard
                title={group.title}
                thumbnail={group.posterPath ? getImageUrl(group.posterPath) : '/placeholder.svg'}
                category={group.type}
                onPlay={() => {
                  if (group.type === 'series') {
                    setSelectedGroup(group);
                  } else {
                    navigate(`/watch-local/${group.items[0].id}`);
                  }
                }}
                onDetails={() => {
                  if (group.type === 'series') setSelectedGroup(group);
                }}
                hasInternalPlayer={true}
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setItemToDelete(group);
                }}
                className={`absolute top-2 right-2 p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity z-10 shadow-lg ${FOCUSABLE_CLASS}`}
                tabIndex={0}
                title="Remover da Biblioteca"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {isScanning && (
             <div className="flex-shrink-0 w-[140px] sm:w-[160px] h-[200px] sm:h-[240px] rounded-lg bg-zinc-900/50 animate-pulse flex items-center justify-center border border-dashed border-zinc-800">
               <RefreshCw className="w-8 h-8 text-zinc-700 animate-spin" />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
