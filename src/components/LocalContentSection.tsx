import React, { useState } from 'react';
import { ContentCard } from './ContentCard';
import { useLocalLibrary } from '@/hooks/useLocalLibrary';
import { FolderPlus, RefreshCw, Library, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { getImageUrl } from '@/lib/tmdb';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { toast } from 'sonner';

interface LocalContentSectionProps {
  fullPage?: boolean; // When true, renders as a full-page offline view
}

export const LocalContentSection = ({ fullPage = false }: LocalContentSectionProps) => {
  const navigate = useNavigate();
  const { localMovies, isScanning, addFolder, scanLibrary, removeMovie } = useLocalLibrary();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

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
        <div className="flex flex-col items-center justify-center py-12 px-6 rounded-3xl border-2 border-dashed border-zinc-800 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer w-full max-w-lg" onClick={addFolder}>
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
          <Button onClick={(e) => { e.stopPropagation(); addFolder(); }} className="rounded-full px-8">
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
          <Button variant="ghost" size="sm" onClick={scanLibrary} disabled={isScanning} className="text-zinc-400 hover:text-white px-2 sm:px-3">
             <RefreshCw className={`w-4 h-4 sm:mr-2 ${isScanning ? 'animate-spin' : ''}`} />
             <span className="hidden sm:inline">Sincronizar</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={addFolder} className="text-zinc-400 hover:text-white px-2 sm:px-3">
             <FolderPlus className="w-4 h-4 sm:mr-2" />
             <span className="hidden sm:inline">Nova Pasta</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowConfirmClear(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 sm:px-3">
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
              <Button variant="ghost" onClick={() => setShowConfirmClear(false)} className="text-zinc-400">
                Cancelar
              </Button>
              <Button onClick={handleClearAll} className="bg-red-600 hover:bg-red-500 text-white">
                Limpar Tudo
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="relative group/row">
        <div className={`flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 pb-4 ${fullPage ? 'flex-wrap justify-center sm:justify-start' : ''}`}>
          {localMovies.map((movie) => (
            <ContentCard
              key={movie.id || movie.filePath}
              title={movie.title}
              thumbnail={movie.posterPath ? getImageUrl(movie.posterPath) : '/placeholder.svg'}
              category={movie.type === 'episode' ? 'series' : 'movie'}
              onPlay={() => {
                navigate(`/watch-local/${movie.id}`);
              }}
              onDetails={() => {}}
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
