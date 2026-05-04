import { useState, useEffect } from "react";
import { Search as SearchIcon, X, Filter, SlidersHorizontal, Film, Tv, Sparkles, Clock, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ContentCard } from "@/components/ContentCard";
import { getAllContents } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Content } from "@/types/content";
import { QuickViewModal } from "@/components/QuickViewModal";

const Search = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [allContents, setAllContents] = useState<Content[]>([]);
  const [filteredResults, setFilteredResults] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);

  const categories = [
    { id: 'movie', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Tv },
    { id: 'nostalgia', label: 'Nostalgia', icon: Sparkles },
    { id: 'tv', label: 'TV Online', icon: Tv },
    { id: 'canais24h', label: 'Canais 24h', icon: Clock },
  ];

  useEffect(() => {
    const loadContent = async () => {
      try {
        const contents = await getAllContents();
        setAllContents(contents);
        setFilteredResults(contents);
      } catch (error) {
        console.error("Error loading search content:", error);
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, []);

  useEffect(() => {
    let results = allContents;

    if (searchQuery) {
      results = results.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      results = results.filter(c => c.category === selectedCategory);
    }

    setFilteredResults(results);
  }, [searchQuery, selectedCategory, allContents]);

    const isSeries = content.category?.toLowerCase() === 'series' || 
                    content.category?.toLowerCase() === 'série' || 
                    content.category?.toLowerCase() === 'serie' ||
                    (content.episodes && content.episodes.length > 0);

    if (content.category === 'nostalgia') {
      navigate(`/nostalgia/${content.id}`);
    } else if (isSeries) {
      navigate(`/content/${content.id}?showEpisodes=true`);
    } else if (content.category === 'tv' || content.category === 'canais24h') {
      navigate(`/tv?channelId=${content.id}`);
    } else {
      navigate(`/watch/${content.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Search Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
              <SearchIcon className="w-8 h-8 text-primary" />
              Pesquisa Avançada
            </h1>
            <p className="text-muted-foreground">Encontre seus filmes, séries e canais favoritos</p>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por título, descrição..."
              className="w-full h-14 pl-12 pr-12 bg-secondary/20 border-white/10 rounded-2xl text-lg focus:ring-2 focus:ring-primary/20 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2">
             <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="rounded-full"
                size="sm"
              >
                Todos
              </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className="rounded-full gap-2"
                size="sm"
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Results Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {searchQuery || selectedCategory ? 'Resultados Encontrados' : 'Sugestões de Conteúdo'}
              </h2>
              <span className="text-sm text-muted-foreground">{filteredResults.length} resultados</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-secondary/20 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : filteredResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredResults.map((content) => (
                  <ContentCard
                    key={content.id}
                    title={content.title}
                    thumbnail={content.thumbnail_url}
                    onPlay={() => handlePlay(content)}
                    onInfo={() => setQuickViewContent(content)}
                    isPremium={content.isPremium}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-secondary/10 rounded-3xl border border-dashed border-white/10">
                <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium">Nenhum resultado encontrado</p>
                <p className="text-muted-foreground mt-2">Tente pesquisar com outros termos ou categorias</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {quickViewContent && (
        <QuickViewModal
          open={!!quickViewContent}
          onClose={() => setQuickViewContent(null)}
          content={quickViewContent}
        />
      )}
    </div>
  );
};

export default Search;
