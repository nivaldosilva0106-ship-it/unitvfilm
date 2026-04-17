import React from 'react';
import { ContentCard } from './ContentCard';
import { useLocalLibrary } from '@/hooks/useLocalLibrary';
import { FolderPlus, RefreshCw, HardDrive } from 'lucide-react';
import { Button } from './ui/button';
import { getImageUrl } from '@/lib/tmdb';
import { useNavigate } from 'react-router-dom';

export const LocalContentSection = () => {
  const navigate = useNavigate();
  const { localMovies, isScanning, addFolder, scanLibrary } = useLocalLibrary();

  if (localMovies.length === 0 && !isScanning) {
    return (
      <div className="mb-12 px-4 sm:px-8">
        <div className="flex items-center gap-3 mb-6">
          <HardDrive className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">Arquivos Locais</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 rounded-3xl border-2 border-dashed border-zinc-800 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer" onClick={addFolder}>
          <div className="bg-primary/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
             <FolderPlus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Sua biblioteca está vazia</h3>
          <p className="text-zinc-400 text-sm text-center max-w-md mb-6">
            Adicione uma pasta do seu computador ou celular para indexar seus filmes e séries locais com pôsteres e informações do TMDB.
          </p>
          <Button onClick={(e) => { e.stopPropagation(); addFolder(); }} className="rounded-full px-8">
            Adicionar Pasta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">Arquivos Locais</h2>
          {isScanning && <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={scanLibrary} disabled={isScanning} className="text-zinc-400 hover:text-white">
             <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
             Sincronizar
          </Button>
          <Button variant="ghost" size="sm" onClick={addFolder} className="text-zinc-400 hover:text-white">
             <FolderPlus className="w-4 h-4 mr-2" />
             Nova Pasta
          </Button>
        </div>
      </div>

      <div className="relative group/row">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 pb-4">
          {localMovies.map((movie) => (
            <ContentCard
              key={movie.filePath}
              title={movie.title}
              thumbnail={movie.posterPath ? getImageUrl(movie.posterPath) : '/placeholder.svg'}
              category={movie.type === 'episode' ? 'series' : 'movie'}
              onPlay={() => {
                navigate(`/watch-local/${movie.id}`);
              }}
              onDetails={() => {
                // If it has tmdbId, show normal details, or a custom local details modal
              }}
              hasInternalPlayer={true}
            />
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
