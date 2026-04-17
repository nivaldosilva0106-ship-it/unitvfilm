import { useState, useCallback, useEffect } from 'react';
import { db, type LocalMovie, type LocalFolder } from '@/lib/db';
import { parseFileName } from '@/lib/filename-parser';
import { searchMovies, searchSeries, getMovieDetails, getSeriesDetails } from '@/lib/tmdb';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

export function useLocalLibrary() {
  const [isScanning, setIsScanning] = useState(false);
  const [localMovies, setLocalMovies] = useState<LocalMovie[]>([]);
  const isOnline = useOnlineStatus();

  const loadLibrary = useCallback(async () => {
    const movies = await db.movies.toArray();
    setLocalMovies(movies);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const addFolder = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // On native, prompt the user for a folder path
        // (e.g. /storage/emulated/0/Movies)
        const path = window.prompt(
          'Digite o caminho da pasta (ex: /storage/emulated/0/Movies)'
        );
        if (path && path.trim()) {
          const name = path.trim().split('/').filter(Boolean).pop() || 'Pasta Local';
          await db.folders.add({
            path: path.trim(),
            name,
            lastScanned: Date.now()
          });
          toast.success(`Pasta "${name}" adicionada!`);
          scanLibrary();
        }
      } else if ('showDirectoryPicker' in window) {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        await db.folders.add({
          path: handle.name,
          name: handle.name,
          handle: handle,
          lastScanned: Date.now()
        });
        toast.success(`Pasta "${handle.name}" adicionada!`);
        scanLibrary();
      } else {
        toast.error('Seu navegador não suporta seleção de pastas.');
      }
    } catch (error) {
      console.error('Erro ao adicionar pasta:', error);
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta.');
      }
    }
  }, []);

  const scanLibrary = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    
    try {
      const folders = await db.folders.toArray();
      
      for (const folder of folders) {
        if (Capacitor.isNativePlatform()) {
          await scanCapacitorFolder(folder);
        } else if (folder.handle) {
          await scanWebFolder(folder);
        }
      }
      
      await loadLibrary();
      toast.success("Biblioteca atualizada!");
    } catch (error) {
      console.error("Erro no scan:", error);
      toast.error("Erro ao escanear biblioteca.");
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, loadLibrary]);

  const scanWebFolder = async (folder: LocalFolder) => {
    const handle = folder.handle;
    if (!handle) return;
    
    // Request permission if needed
    // @ts-ignore
    if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
       // @ts-ignore
       if ((await handle.requestPermission({ mode: 'read' })) !== 'granted') return;
    }

    const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov'];
    
    // @ts-ignore
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const ext = file.name.split('.').pop()?.toLowerCase();
        
        if (ext && videoExts.includes(ext)) {
          await processFile(file.name, entry.name, file.size, file.lastModified, folder.name);
        }
      }
      // Recursive scan could be added here
    }
  };

  const scanCapacitorFolder = async (folder: LocalFolder) => {
    try {
       const result = await Filesystem.readdir({
         path: folder.path
       });
       
       const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov'];
       
       for (const file of result.files) {
         if (file.type === 'file') {
           const ext = file.name.split('.').pop()?.toLowerCase();
           if (ext && videoExts.includes(ext)) {
             // Capacitor readdir doesn't give size/mtime directly for all files in result.files in some versions
             // We use stats or default values
             await processFile(file.name, file.uri || file.path, 0, Date.now(), folder.name);
           }
         }
       }
    } catch (e) {
      console.error("Capacitor readdir error:", e);
    }
  };

  const processFile = async (fileName: string, filePath: string, size: number, mtime: number, folderName: string) => {
    // Check if already exists
    const existing = await db.movies.where('filePath').equals(filePath).first();
    if (existing) return;

    const parsed = parseFileName(fileName);
    let metadata: any = null;
    
    if (isOnline) {
      try {
        // Try to match on TMDB
        const results = parsed.season ? await searchSeries(parsed.cleanTitle) : await searchMovies(parsed.cleanTitle);
        if (results && results.length > 0) {
          const match = results[0];
          // Simple heuristic: year match
          const tmdbId = match.id;
          metadata = parsed.season ? await getSeriesDetails(tmdbId) : await getMovieDetails(tmdbId);
        }
      } catch (e) {
        console.error("TMDB match error:", e);
      }
    }

    const movie: LocalMovie = {
      title: metadata?.title || metadata?.name || parsed.cleanTitle,
      tmdbId: metadata?.id,
      fileName,
      filePath,
      fileSize: size,
      lastModified: mtime,
      folderPath: folderName,
      type: parsed.season ? 'episode' : 'movie',
      year: parsed.year || (metadata?.release_date ? new Date(metadata.release_date).getFullYear() : undefined),
      overview: metadata?.overview,
      posterPath: metadata?.poster_path,
      backdropPath: metadata?.backdrop_path,
      voteAverage: metadata?.vote_average,
      season: parsed.season,
      episode: parsed.episode,
      seriesName: parsed.season ? (metadata?.name || parsed.cleanTitle) : undefined
    };

    await db.movies.add(movie);
  };

  const removeMovie = useCallback(async (id: number) => {
    await db.movies.delete(id);
    await loadLibrary();
  }, [loadLibrary]);

  return {
    isScanning,
    localMovies,
    addFolder,
    scanLibrary,
    removeMovie
  };
}
