import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ContentRow } from "@/components/ContentRow";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { getContentsByCategory, getAllContents } from "@/lib/firebase";
import { toast } from "sonner";
import type { Content } from "@/types/content";

const Index = () => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<Content[]>([]);
  const [series, setSeries] = useState<Content[]>([]);
  const [tvChannels, setTvChannels] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [allContents, setAllContents] = useState<Content[]>([]);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (allContents.length > 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allContents.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [allContents]);

  const loadContent = async () => {
    try {
      const [moviesData, seriesData, tvData, allData] = await Promise.all([
        getContentsByCategory("movie"),
        getContentsByCategory("series"),
        getContentsByCategory("tv"),
        getAllContents(),
      ]);

      setMovies(moviesData);
      setSeries(seriesData);
      setTvChannels(tvData);
      setAllContents(allData);
      
      // Set random content once after data is loaded
      const shuffled = [...allData].sort(() => 0.5 - Math.random());
      setRandomContent(shuffled.slice(0, 10));
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayContent = (content: Content) => {
    if (content.category === 'series' && content.episodes && content.episodes.length > 0) {
      setSelectedSeries(content);
    } else if (content.video_url) {
      window.open(content.video_url, '_blank');
    } else {
      toast.error("Link de vídeo não disponível");
    }
  };

  const handleInfoContent = (content: Content) => {
    navigate(`/content/${content.id}`);
  };

  const handleDownloadContent = (content: Content) => {
    if (content.download_url) {
      window.open(content.download_url, '_blank');
    } else {
      toast.error("Link de download não disponível");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative py-16 flex items-center justify-center overflow-hidden">
        {/* Background Images Carousel */}
        {allContents.length > 0 && (
          <div className="absolute inset-0 z-0">
            {allContents.map((content, index) => (
              <div
                key={content.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={content.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
          </div>
        )}

        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-3 drop-shadow-lg">
            Bem-vindo ao Uni<span className="text-primary glow-effect">Tv</span>Film
          </h1>
          <p className="text-lg text-foreground/90 drop-shadow-md">
            Sua plataforma de streaming com os melhores filmes, séries e canais de TV
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div className="pt-4 pb-16">
        {/* Featured Random Content - Always First */}
        {randomContent.length > 0 && (
          <ContentRow 
            title="Em Destaque" 
            contents={randomContent}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}

        {movies.length > 0 && (
          <ContentRow 
            title="Filmes" 
            contents={movies}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}
        
        {series.length > 0 && (
          <ContentRow 
            title="Séries" 
            contents={series}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}
        
        {tvChannels.length > 0 && (
          <ContentRow 
            title="TV ao Vivo" 
            contents={tvChannels}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}

        {movies.length === 0 && series.length === 0 && tvChannels.length === 0 && (
          <div className="text-center py-16 px-4">
          <p className="text-xl text-muted-foreground">
              Nenhum conteúdo disponível ainda. Acesse o painel admin para adicionar!
            </p>
          </div>
        )}
      </div>

      {/* Episode Selector Modal */}
      {selectedSeries && (
        <EpisodeSelector
          open={!!selectedSeries}
          onClose={() => setSelectedSeries(null)}
          episodes={selectedSeries.episodes || []}
          title={selectedSeries.title}
        />
      )}
    </div>
  );
};

export default Index;
