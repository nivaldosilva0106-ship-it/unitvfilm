import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type LocalMovie } from '@/lib/db';
import { ChevronLeft, AlertTriangle, RefreshCw, SkipForward, Maximize, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

const LocalPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<LocalMovie | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextMovie, setNextMovie] = useState<LocalMovie | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadMovie = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await db.movies.get(Number(id));
        if (!data) {
          setError('Arquivo não encontrado no banco de dados.');
          setLoading(false);
          return;
        }
        
        setMovie(data);

        // Find Next Episode Logic
        try {
          // If it's a series, find by seriesName, otherwise by folderPath
          const sameGroup = data.type === 'episode' && data.seriesName
            ? await db.movies.where('seriesName').equals(data.seriesName).toArray()
            : await db.movies.where('folderPath').equals(data.folderPath).toArray();

          // Sort by season/episode or filename
          sameGroup.sort((a, b) => {
            if (a.type === 'episode' && b.type === 'episode') {
              if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
              return (a.episode || 0) - (b.episode || 0);
            }
            return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
          });

          const currentIdx = sameGroup.findIndex(m => m.id === data.id);
          if (currentIdx !== -1 && currentIdx < sameGroup.length - 1) {
            setNextMovie(sameGroup[currentIdx + 1]);
          } else {
            setNextMovie(null);
          }
        } catch (groupError) {
          console.error('Error finding next movie:', groupError);
        }

        if (Capacitor.isNativePlatform()) {
          setVideoUrl(Capacitor.convertFileSrc(data.filePath));
        } else if (data.fileHandle) {
          const handle = data.fileHandle;
          // @ts-ignore
          const permission = await handle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
            // @ts-ignore
            const requested = await handle.requestPermission({ mode: 'read' });
            if (requested !== 'granted') {
              setError('Permissão de leitura negada. Re-adicione a pasta.');
              setLoading(false);
              return;
            }
          }

          const file = await handle.getFile();
          objectUrl = URL.createObjectURL(file);
          setVideoUrl(objectUrl);
        } else {
          setError('Handle de acesso ausente. Re-adicione a pasta.');
        }
      } catch (err) {
        console.error('Error loading local movie:', err);
        setError('Erro ao carregar o arquivo.');
      } finally {
        setLoading(false);
      }
    };

    loadMovie();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [id]);

  const handleNext = () => {
    if (nextMovie?.id) {
      navigate(`/watch-local/${nextMovie.id}`);
    }
  };

  const resetOverlayTimer = () => {
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 3000);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (nextMovie) {
        toast.info(`Iniciando próximo: ${nextMovie.fileName.substring(0, 30)}...`);
        handleNext();
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [nextMovie]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="relative">
          <RefreshCw className="w-12 h-12 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
        </div>
        <p className="text-zinc-400 font-medium animate-pulse">Preparando player local...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-6 px-8">
        <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-red-500/20 max-w-md text-center shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-white">Erro ao reproduzir</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            {error || 'O arquivo não pôde ser encontrado ou acessado.'}
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/')} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6 font-bold">
              Voltar à Biblioteca
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()} className="text-zinc-500">
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen w-screen bg-black relative flex flex-col overflow-hidden group"
      onMouseMove={resetOverlayTimer}
      onClick={resetOverlayTimer}
      onTouchStart={resetOverlayTimer}
    >
      {/* Premium Header — Synced with Player.tsx */}
      <div className={`absolute top-0 left-0 right-0 z-50 p-4 sm:p-8 bg-gradient-to-b from-black via-black/60 to-transparent flex items-center justify-between transition-opacity duration-500 ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full h-12 w-12 text-white hover:bg-white/20 transition-all flex-shrink-0">
            <ChevronLeft className="w-8 h-8" />
          </Button>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
               <span className="px-2 py-0.5 rounded bg-primary/90 text-[10px] font-black text-white uppercase tracking-tighter">Local</span>
               {movie.type === 'episode' && movie.season && (
                 <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest border-l border-zinc-700 pl-2">S{movie.season} E{movie.episode}</span>
               )}
            </div>
            {/* Title with potential scrolling if too long */}
            <div className="relative overflow-hidden h-8 flex items-center">
              <h1 className="text-lg sm:text-2xl font-black text-white whitespace-nowrap tracking-tight">
                {movie.title}
              </h1>
            </div>
            <p className="text-zinc-500 text-[10px] sm:text-xs truncate max-w-md opacity-70">
              {movie.fileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {nextMovie && (
             <Button 
               variant="ghost" 
               onClick={handleNext}
               className="hidden sm:flex text-white hover:bg-white/10 gap-2 border border-white/5 rounded-full px-4"
             >
               <SkipForward className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-wider">Próximo</span>
             </Button>
           )}
           <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12">
             <List className="w-5 h-5" />
           </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <video
          ref={videoRef}
          src={videoUrl || ''}
          controls={showOverlay}
          autoPlay
          className="w-full h-full object-contain cursor-none"
          controlsList="nodownload"
          playsInline
        >
          Seu navegador não suporta este formato de vídeo.
        </video>

        {/* Custom Overlay for Next Episode Prompt when video nears end could go here */}
      </div>

      {/* Mobile-only Next Button Overlay */}
      {nextMovie && !showOverlay && (
        <div className="absolute bottom-10 right-10 z-50 sm:hidden">
           <Button 
            onClick={handleNext} 
            className="w-14 h-14 rounded-full bg-primary/80 backdrop-blur-md shadow-2xl flex items-center justify-center animate-bounce"
           >
             <SkipForward className="w-6 h-6 text-white" />
           </Button>
        </div>
      )}
    </div>
  );
};

export default LocalPlayer;
