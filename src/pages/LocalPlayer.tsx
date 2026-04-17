import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type LocalMovie } from '@/lib/db';
import { ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';

const LocalPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<LocalMovie | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadMovie = async () => {
      if (!id) return;
      
      try {
        const data = await db.movies.get(Number(id));
        if (!data) {
          setError('Arquivo não encontrado no banco de dados.');
          setLoading(false);
          return;
        }
        
        setMovie(data);

        if (Capacitor.isNativePlatform()) {
          // For Capacitor/Android, convert the native path to a webview-compatible URL
          setVideoUrl(Capacitor.convertFileSrc(data.filePath));
        } else if (data.fileHandle) {
          // Web: Use the stored FileSystemFileHandle to get a real File object
          const handle = data.fileHandle;

          // Request permission if needed (handles persist across sessions in IndexedDB)
          // @ts-ignore — queryPermission/requestPermission are part of the File System Access API
          const permission = await handle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
            // @ts-ignore
            const requested = await handle.requestPermission({ mode: 'read' });
            if (requested !== 'granted') {
              setError('Permissão de leitura negada. Por favor, re-adicione a pasta na biblioteca.');
              setLoading(false);
              return;
            }
          }

          // Get the File object and create a blob URL
          const file = await handle.getFile();
          objectUrl = URL.createObjectURL(file);
          setVideoUrl(objectUrl);
        } else {
          setError(
            'Este arquivo foi indexado sem um handle de acesso. ' +
            'Por favor, remova-o da biblioteca e re-adicione a pasta para corrigir.'
          );
        }
      } catch (err) {
        console.error('Error loading local movie:', err);
        setError('Erro ao carregar o arquivo. Tente re-adicionar a pasta.');
      } finally {
        setLoading(false);
      }
    };

    loadMovie();

    // Cleanup: revoke the object URL when unmounting
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);

  // Handle re-adding: clear movies without handles so user can rescan
  const handleRescan = async () => {
    if (movie?.id) {
      await db.movies.delete(movie.id);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-zinc-400">Carregando player local...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-6 px-8">
        <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl border border-red-500/30 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Erro ao reproduzir</h2>
          <p className="text-zinc-400 text-sm mb-6">
            {error || 'Arquivo não encontrado.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-zinc-400">
              Voltar
            </Button>
            <Button onClick={handleRescan} className="bg-primary hover:bg-primary/90">
              Re-escanear biblioteca
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-white hover:bg-white/10">
          <ChevronLeft className="w-7 h-7" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">{movie.title}</h1>
          <p className="text-zinc-400 text-xs sm:text-sm truncate">
            Reproduzindo localmente • {movie.fileName}
          </p>
        </div>
      </div>

      {/* Native HTML5 Video Player */}
      <div className="flex-1 flex items-center justify-center bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            controlsList="nodownload"
            playsInline
          >
            Seu navegador não suporta este formato de vídeo.
          </video>
        ) : (
          <p className="text-zinc-500">Nenhum URL de vídeo disponível.</p>
        )}
      </div>
    </div>
  );
};

export default LocalPlayer;
