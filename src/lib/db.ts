import Dexie, { type Table } from 'dexie';

export interface LocalMovie {
  id?: number;
  title: string;
  originalTitle?: string;
  year?: number;
  tmdbId?: number;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  genreNames?: string[];
  
  // Local File Info
  fileName: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
  folderPath: string;
  
  // Content type
  type: 'movie' | 'episode';
  seriesName?: string;
  season?: number;
  episode?: number;
}

export interface LocalFolder {
  id?: number;
  path: string;
  name: string;
  handle?: FileSystemDirectoryHandle; // Web only
  lastScanned: number;
}

export class LocalLibraryDB extends Dexie {
  movies!: Table<LocalMovie>;
  folders!: Table<LocalFolder>;

  constructor() {
    super('LocalLibraryDB');
    this.version(1).stores({
      movies: '++id, tmdbId, title, fileName, filePath, folderPath, type, seriesName',
      folders: '++id, path, name'
    });
  }
}

export const db = new LocalLibraryDB();
