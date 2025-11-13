import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ContentRow } from "@/components/ContentRow";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { getAllContents } from "@/lib/firebase";
import { toast } from "sonner";
import type { Content } from "@/types/content";

const ALL_CATEGORIES = ['Todos', 'Filmes', 'Séries', 'TV ao Vivo', 'Lançamentos', 'Ação', 'Terror'];

const Index = () => {
  const navigate = useNavigate();
  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, title: string }>({ open: false, url: '', title: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');


  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (allContentData.length > 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allContentData.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [allContentData]);

  const loadContent = async () => {
    try {
      // Carrega todo o conteúdo de uma vez para facilitar a filtragem local
      const allData = await getAllContents();
      setAllContentData(allData);
      
      // Set random content once after data is loaded
      const shuffled = [...allData].sort(() => 0.5 - Math.random());
      setRandomContent(shuffled.slice(0, 10));
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    } finally {
      setLoading(false);
    }
  };

  // Mapeamento e filtragem de conteúdo por categoria
  const categorizedContent = useMemo(() => {
    const data = allContentData;
    
    if (selectedCategory === 'Todos') {
      // Retorna todas as categorias principais para exibição
      return {
        movies: data.filter(c => c.category === 'movie'),
        series: data.filter(c => c.category === 'series'),
        tvChannels: data.filter(c => c.category === 'tv'),
        featured: randomContent,
      };
    }

    // Lógica de filtragem para categorias específicas
    let filtered: Content[] = [];
    let title = selectedCategory;

    switch (selectedCategory) {
      case 'Filmes':
        filtered = data.filter(c => c.category === 'movie');
        break;
      case 'Séries':
        filtered = data.filter(c => c.category === 'series');
        break;
      case 'TV ao Vivo':
        filtered = data.filter(c => c.category === 'tv');
        break;
      case 'Lançamentos':
        // Filtra por data de lançamento (exemplo simples: últimos 3 meses)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        filtered = data.filter(c => c.release_date && new Date(c.release_date) > threeMonthsAgo);
        break;
      case 'Ação':
      case 'Terror':
        // Para fins de demonstração, filtramos por palavras-chave na descrição/título
        const keyword = selectedCategory.toLowerCase();
        filtered = data.filter(c => 
          c.title.toLowerCase().includes(keyword) || 
          c.description?.toLowerCase().includes(keyword)
        );
        break;
      default:
        filtered = [];
    }

    return {
      singleRow: filtered,
      singleRowTitle: title,
    };
  }, [allContentData, selectedCategory, randomContent]);


  const handlePlayContent = (content: Content) => {
    if (content.category === 'series' && content.episodes && content.episodes.length > 0) {
      setSelectedSeries(content);
    } else if (content.video_url) {
      setPlayerModal({ open: true, url: content.video_url, title: content.title });
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

  const showAllRows = selectedCategory === 'Todos';
  const showSingleRow = !showAllRows && categorizedContent.singleRow && categorizedContent.singleRow.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative py-16 flex items-center justify-center overflow-hidden">
        {/* Background Images Carousel */}
        {allContentData.length > 0 && (
          <div className="absolute inset-0 z-0">
            {allContentData.map((content, index) => (
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
          <p className="text-lg text-foreground/90 drop-shadow-md mb-6">
            Sua plataforma de streaming com os melhores filmes, séries e canais de TV
          </p>
          
          {/* Category Navigation */}
          <CategoryNavigation
            categories={ALL_CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      </div>

      {/* Content Sections */}
      <div className="pt-4 pb-16">
        {showAllRows && (
          <>
            {/* Featured Random Content - Always First */}
            {categorizedContent.featured.length > 0 && (
              <ContentRow 
                title="Em Destaque" 
                contents={categorizedContent.featured}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}

            {categorizedContent.movies.length > 0 && (
              <ContentRow 
                title="Filmes" 
                contents={categorizedContent.movies}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}
            
            {categorizedContent.series.length > 0 && (
              <ContentRow 
                title="Séries" 
                contents={categorizedContent.series}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}
            
            {categorizedContent.tvChannels.length > 0 && (
              <ContentRow 
                title="TV ao Vivo" 
                contents={categorizedContent.tvChannels}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}
          </>
        )}
        
        {showSingleRow && (
          <ContentRow 
            title={categorizedContent.singleRowTitle || 'Conteúdo Filtrado'} 
            contents={categorizedContent.singleRow || []}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}

        {!showAllRows && categorizedContent.singleRow && categorizedContent.singleRow.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-xl text-muted-foreground">
              Nenhum conteúdo encontrado na categoria "{selectedCategory}".
            </p>
          </div>
        )}

        {allContentData.length === 0 && (
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
          trailerUrl={selectedSeries.trailer_url}
          onPlayEpisode={(url) => setPlayerModal({ open: true, url, title: selectedSeries.title })}
        />
      )}
      
      {/* Main Player Modal */}
      <ContentPlayerModal
        open={playerModal.open}
        onClose={() => setPlayerModal({ open: false, url: '', title: '' })}
        videoUrl={playerModal.url}
        title={playerModal.title}
      />
    </div>
  );
};

export default Index;