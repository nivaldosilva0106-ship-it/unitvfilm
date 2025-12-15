import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Volume2, VolumeX } from "lucide-react";
import { ContentRow } from "@/components/ContentRow";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { DownloadModal } from "@/components/DownloadModal";
import { AdManager } from "@/components/AdManager";
import { Content } from "@/types/content";
import { getAllContents } from "@/lib/firebase";
import { toast } from "sonner";

const ALL_CATEGORIES = ['Todos', 'Filmes', 'Séries', 'TV ao Vivo', 'Lançamentos', 'Ação', 'Terror'];

const Index = () => {
  const navigate = useNavigate();
  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, title: string, isPremium?: boolean }>({ open: false, url: '', title: '', isPremium: false });
  const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, title: string, thumbnail: string }>({ open: false, url: '', title: '', thumbnail: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  /* New State for Video Slider */
  const [trailerContents, setTrailerContents] = useState<Content[]>([]);
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* Helper to extract YouTube ID - Robust Version */
  const getYouTubeId = (url: string | undefined | null) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    loadContent();
  }, []);

  /* Filter and Shuffle Trailers */
  useEffect(() => {
    if (allContentData.length > 0) {
      const withTrailers = allContentData.filter(c => c.trailer_url && getYouTubeId(c.trailer_url));
      if (withTrailers.length > 0) {
        const shuffled = [...withTrailers].sort(() => 0.5 - Math.random());
        setTrailerContents(shuffled);
      }
    }
  }, [allContentData]);

  /* Image Slider Interval (Fallback) */
  useEffect(() => {
    if (allContentData.length > 0 && trailerContents.length === 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allContentData.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [allContentData, trailerContents]);

  /* Video Slider Interval (60s) */
  useEffect(() => {
    if (trailerContents.length > 0) {
      const interval = setInterval(() => {
        setCurrentTrailerIndex((prev) => (prev + 1) % trailerContents.length);
      }, 60000); // 60 seconds
      return () => clearInterval(interval);
    }
  }, [trailerContents]);

  /* Reset Mute state when slide changes */
  useEffect(() => {
    setIsMuted(true);
  }, [currentTrailerIndex]);

  const loadContent = async () => {
    try {
      const allData = await getAllContents();
      setAllContentData(allData);

      const shuffled = [...allData].sort(() => 0.5 - Math.random());
      setRandomContent(shuffled.slice(0, 10));
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    } finally {
      setLoading(false);
    }
  };

  const toggleAudio = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const action = isMuted ? "unMute" : "mute";
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: action, args: [] }),
        "*"
      );
      setIsMuted(!isMuted);
    }
  };

  // Mapeamento e filtragem de conteúdo por categoria
  const categorizedContent = useMemo(() => {
    const data = allContentData;

    if (selectedCategory === 'Todos') {
      return {
        movies: data.filter(c => c.category === 'movie'),
        series: data.filter(c => c.category === 'series'),
        tvChannels: data.filter(c => c.category === 'tv'),
        featured: randomContent,
      };
    }

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
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        filtered = data.filter(c => c.release_date && new Date(c.release_date) > threeMonthsAgo);
        break;
      case 'Ação':
      case 'Terror':
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
      setPlayerModal({
        open: true,
        url: content.video_url,
        title: content.title,
        isPremium: content.isPremium
      });
    } else {
      toast.error("Link de vídeo não disponível");
    }
  };

  const handleInfoContent = (content: Content) => {
    navigate(`/content/${content.id}`);
  };

  const handleDownloadContent = (content: Content) => {
    if (content.download_url) {
      setDownloadModal({
        open: true,
        url: content.download_url,
        title: content.title,
        thumbnail: content.thumbnail_url
      });
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

  const currentTrailer = trailerContents.length > 0 ? trailerContents[currentTrailerIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Header Ad */}
      <AdManager placement="header" className="container mx-auto px-4 pt-20" />

      {/* Hero Section */}
      <div className="relative py-16 flex items-center justify-center overflow-hidden min-h-[500px]">
        {/* VIDEO SLIDER */}
        {currentTrailer && currentTrailer.trailer_url && getYouTubeId(currentTrailer.trailer_url) ? (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                key={currentTrailer.id}
                className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 opacity-60"
                /* Optimized SRC: removed playlist/loop/end/start. Added enablejsapi=1 */
                src={`https://www.youtube.com/embed/${getYouTubeId(currentTrailer.trailer_url)}?autoplay=1&mute=1&controls=0&enablejsapi=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`}
                title="Hero Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style={{ pointerEvents: 'auto' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/60 to-background/95 pointer-events-none" />
            </div>
          </div>
        ) : (
          /* FALLBACK IMAGE SLIDER */
          allContentData.length > 0 && (
            <div className="absolute inset-0 z-0">
              {allContentData.map((content, index) => (
                <div
                  key={content.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'
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
          )
        )}

        {/* Audio Toggle Button */}
        {currentTrailer && currentTrailer.trailer_url && (
          <div className="absolute right-8 bottom-32 z-30 hidden md:block">
            <button
              onClick={toggleAudio}
              className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 transition-all backdrop-blur-sm"
              aria-label={isMuted ? "Ativar som" : "Mudo"}
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
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

            {/* Between Content Ad */}
            <AdManager placement="between-content" className="container mx-auto px-4" />

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

      {/* Footer Ad */}
      <AdManager placement="footer" className="container mx-auto px-4 pb-8" />

      {/* Mobile Bottom Ad */}
      <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />

      {/* Episode Selector Modal */}
      {selectedSeries && (
        <EpisodeSelector
          open={!!selectedSeries}
          onClose={() => setSelectedSeries(null)}
          episodes={selectedSeries.episodes || []}
          title={selectedSeries.title}
          trailerUrl={selectedSeries.trailer_url}
          onPlayEpisode={(url) => setPlayerModal({ open: true, url, title: selectedSeries.title, isPremium: selectedSeries.isPremium })}
        />
      )}

      {/* Main Player Modal */}
      <ContentPlayerModal
        open={playerModal.open}
        onClose={() => setPlayerModal({ open: false, url: '', title: '', isPremium: false })}
        videoUrl={playerModal.url}
        title={playerModal.title}
        isPremium={playerModal.isPremium}
      />

      {/* Download Modal */}
      <DownloadModal
        open={downloadModal.open}
        onClose={() => setDownloadModal({ open: false, url: '', title: '', thumbnail: '' })}
        downloadUrl={downloadModal.url}
        title={downloadModal.title}
        thumbnail={downloadModal.thumbnail}
      />
    </div>
  );
};

export default Index;