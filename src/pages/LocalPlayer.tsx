import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type LocalMovie } from '@/lib/db';
import { ChevronLeft, AlertTriangle, RefreshCw, SkipForward, List, ChevronDown, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

const PROGRESS_KEY = (id: number) => `local_progress_${id}`;

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
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Continue Watching state
  const [continueWatchingList, setContinueWatchingList] = useState<Array<{ movie: LocalMovie; percent: number; seconds: number }>>([]);
  const [isContinueWatchingOpen, setIsContinueWatchingOpen] = useState(false);

  // Load continue-watching list from all local movies
  const loadContinueWatching = useCallback(async (currentId: number) => {
    try {
      const all = await db.movies.toArray();
      const withProgress: Array<{ movie: LocalMovie; percent: number; seconds: number }> = [];

      for (const m of all) {
        if (!m.id || m.id === currentId) continue;
        const saved = localStorage.getItem(PROGRESS_KEY(m.id));
        if (!saved) continue;
        try {
          const data = JSON.parse(saved);
          const percent = data.percent || 0;
          if (percent > 2 && percent < 95) {
            withProgress.push({ movie: m, percent, seconds: data.seconds || 0 });
          }
        } catch {}
      }

      // Sort by most recently watched
      withProgress.sort((a, b) => {
        const ka = localStorage.getItem(PROGRESS_KEY(a.movie.id!));
        const kb = localStorage.getItem(PROGRESS_KEY(b.movie.id!));
        const ta = ka ? (JSON.parse(ka).timestamp || 0) : 0;
        const tb = kb ? (JSON.parse(kb).timestamp || 0) : 0;
        return tb - ta;
      });

      setContinueWatchingList(withProgress);
    } catch {}
  }, []);

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
        loadContinueWatching(data.id!);

        // Find Next Episode Logic
        try {
          const sameGroup = data.type === 'episode' && data.seriesName
            ? await db.movies.where('seriesName').equals(data.seriesName).toArray()
            : await db.movies.where('folderPath').equals(data.folderPath).toArray();

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
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [id]);

  // Save progress periodically
  useEffect(() => {
    if (!movie?.id || !videoRef.current) return;

    const saveProgress = () => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      const percent = Math.round((video.currentTime / video.duration) * 100);
      localStorage.setItem(PROGRESS_KEY(movie.id!), JSON.stringify({
        seconds: Math.floor(video.currentTime),
        percent,
        timestamp: Date.now(),
      }));
    };

    progressIntervalRef.current = setInterval(saveProgress, 5000);
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [movie]);

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
      className="min-h-screen w-screen bg-black text-white flex flex-col overflow-x-hidden"
      onMouseMove={resetOverlayTimer}
      onClick={resetOverlayTimer}
      onTouchStart={resetOverlayTimer}
    >
      {/* Video section */}
      <div className="relative w-full h-screen flex flex-col overflow-hidden group">
        {/* Premium Header */}
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

        {/* Continue Watching Toggle Button — bottom center, like Player.tsx */}
        {continueWatchingList.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 pointer-events-auto">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setIsContinueWatchingOpen(!isContinueWatchingOpen);
                if (!isContinueWatchingOpen) {
                  setTimeout(() => {
                    document.getElementById('local-continue-watching')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }
              }}
              variant="ghost"
              size="icon"
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-primary hover:scale-110 ${isContinueWatchingOpen ? 'rotate-180' : ''}`}
            >
              <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8" />
            </Button>
          </div>
        )}
      </div>

      {/* Continue Watching Expandable Section */}
      {continueWatchingList.length > 0 && (
        <div
          id="local-continue-watching"
          className={`transition-all duration-700 ease-in-out overflow-hidden ${isContinueWatchingOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="px-6 md:px-12 py-12 pb-24 bg-gradient-to-b from-black to-[#0a0a0a]">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Continuar Assistindo</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {continueWatchingList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/watch-local/${item.movie.id}`)}
                  className="group/card relative cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5 shadow-xl transition-all duration-300 group-hover/card:scale-105 group-hover/card:border-primary/50 group-hover/card:shadow-primary/20 bg-zinc-900 flex items-center justify-center">
                    {/* Folder/file icon as placeholder */}
                    <div className="flex flex-col items-center justify-center gap-2 px-3 text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <Play className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60" />

                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-2xl transform scale-75 group-hover/card:scale-100 transition-transform duration-300">
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                      <div
                        className="h-full bg-primary shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-sm font-bold text-white line-clamp-1 group-hover/card:text-primary transition-colors">
                      {item.movie.title}
                    </h3>
                    {item.movie.type === 'episode' && item.movie.season && (
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                        T{item.movie.season} E{item.movie.episode}
                      </p>
                    )}
                    <p className="text-[10px] text-primary/80 font-bold mt-1">
                      {item.percent}% assistido
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalPlayer;
