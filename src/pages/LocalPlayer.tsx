import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type LocalMovie } from '@/lib/db';
import ReactPlayer from 'react-player';
import { ChevronLeft, Maximize, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

const LocalPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<LocalMovie | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovie = async () => {
      if (!id) return;
      const data = await db.movies.get(Number(id));
      if (data) {
        setMovie(data);
        
        if (Capacitor.isNativePlatform()) {
          // For Capacitor, we need the webview-compatible path
          setVideoUrl(Capacitor.convertFileSrc(data.filePath));
        } else {
          // For Web, if we only have the path/name, we might need a file handle
          // If we indexed files, we should have stored a blob or handle
          // In this simplified version, we'll suggest the user needs to re-pick if permissions lost
          setVideoUrl(data.filePath); // This might fail if browser security blocks it
        }
      }
      setLoading(false);
    };

    loadMovie();
  }, [id]);

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Carregando player local...</div>;
  if (!movie) return <div className="h-screen bg-black flex items-center justify-center text-white">Arquivo não encontrado.</div>;

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-white hover:bg-white/10">
          <ChevronLeft className="w-8 h-8" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{movie.title}</h1>
          <p className="text-zinc-400 text-sm">Reproduzindo localmente • {movie.fileName}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <ReactPlayer
          url={videoUrl || ''}
          width="100%"
          height="100%"
          controls={true}
          playing={true}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload'
              }
            }
          }}
        />
      </div>
      
      {/* Footer / Controls overlay could be added here */}
    </div>
  );
};

export default LocalPlayer;
