import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { getAllContents } from '@/lib/firebase';
import type { Content } from '@/types/content';

export const SearchDropdown = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Content[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allContents, setAllContents] = useState<Content[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContents();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = allContents.filter(content =>
        content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        content.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setResults(filtered.slice(0, 8));
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [searchQuery, allContents]);

  const loadContents = async () => {
    const contents = await getAllContents();
    setAllContents(contents);
  };

  const handleResultClick = (content: Content) => {
    navigate(`/content/${content.id}`);
    setSearchQuery('');
    setIsOpen(false);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'movie': return 'Filme';
      case 'series': return 'Série';
      case 'tv': return 'TV';
      default: return category;
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.trim() && setIsOpen(true)}
          className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          {results.map((content) => (
            <button
              key={content.id}
              onClick={() => handleResultClick(content)}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left"
            >
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-16 h-24 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{content.title}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {content.description}
                </p>
                <span className="inline-block mt-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                  {getCategoryLabel(content.category)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchQuery.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
          <p className="text-muted-foreground text-center">Nenhum resultado encontrado</p>
        </div>
      )}
    </div>
  );
};
