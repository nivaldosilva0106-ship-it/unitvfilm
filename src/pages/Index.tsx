import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star } from "lucide-react";
import { ContentRow } from "@/components/ContentRow";
import { MarqueeContentRow } from "@/components/MarqueeContentRow";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { Content } from "@/types/content";
import { getAllContents, getMyList, addToMyList, removeFromMyList, getSliderSettings, type SliderSettings } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { MyListItem } from "@/types/user";

// Lazy load heavy components
const EpisodeSelector = React.lazy(() => import("@/components/EpisodeSelector").then(module => ({ default: module.EpisodeSelector })));
const ContentPlayerModal = React.lazy(() => import("@/components/ContentPlayerModal").then(module => ({ default: module.ContentPlayerModal })));
const DownloadModal = React.lazy(() => import("@/components/DownloadModal").then(module => ({ default: module.DownloadModal })));
const CinemaWarningModal = React.lazy(() => import("@/components/CinemaWarningModal").then(module => ({ default: module.CinemaWarningModal })));
const QuickViewModal = React.lazy(() => import("@/components/QuickViewModal").then(module => ({ default: module.QuickViewModal })));
const AdManager = React.lazy(() => import("@/components/AdManager").then(module => ({ default: module.AdManager })));

const ALL_CATEGORIES = ['Todos', 'Filmes', 'Séries', 'TV ao Vivo', 'Lançamentos', 'Ação', 'Terror'];

const Index = () => {
  const navigate = useNavigate();
  const { user, currentProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && !currentProfile) {
      navigate('/profiles');
    }
  }, [user, currentProfile, authLoading, navigate]);

  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string, internalUrl?: string, nextEpisode?: any }>({ open: false, url: '', title: '', isPremium: false });
  const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[], downloadMode?: 'direct' | 'torrent' | 'mixed', title: string, thumbnail: string }>({ open: false, url: '', title: '', thumbnail: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  /* New State for Quick View */
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);

  /* New State  /* Slider State */
  const [trailerContents, setTrailerContents] = useState<Content[]>([]);
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false); // For smooth fade
  import { IndexHero } from "@/components/IndexHero";

  // ... (existing imports and lazy loads)

  const Index = () => {
    // ... (existing state)
    const [isMuted, setIsMuted] = useState(true);
    const [heroTextVisible, setHeroTextVisible] = useState(true);
    const [showVideo, setShowVideo] = useState(false);
    // iframeRef removed as it's now in IndexHero

    // ... (existing effects up to line 220)

    /* AGGRESSIVE UNMUTE Logic */
    useEffect(() => {
      /* Always set muted to FALSE when invalidating index or mounting */
      setIsMuted(false);
    }, [currentTrailerIndex, playerModal.open]);

    /* Auto-advance slider when returning from player modal */
    useEffect(() => {
      if (!playerModal.open && trailerContents.length > 0) {
        /* When modal closes, advance to next trailer */
        setCurrentTrailerIndex((prev) => (prev + 1) % trailerContents.length);
      }
    }, [playerModal.open]);

    const loadContent = async () => {
      // ... (existing loadContent)
    };

    const toggleAudio = () => {
      setIsMuted(!isMuted);
    };

    // ... (existing handlers)

    // ... (JSX start)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />

        {/* Header Ad */}
        <AdManager placement="header" className="container mx-auto px-4 pt-20" />

        {/* Hero Section */}
        <IndexHero
          currentTrailer={currentTrailer}
          showVideo={showVideo}
          getYouTubeId={getYouTubeId}
          isTransitioning={isTransitioning}
          isMuted={isMuted}
          heroTextVisible={heroTextVisible}
          activeContent={activeContent}
          allContentData={allContentData}
          currentImageIndex={currentImageIndex}
          playerModalOpen={playerModal.open}
          quickViewContentOpen={!!quickViewContent}
          selectedSeriesOpen={!!selectedSeries}
          isInList={isInList}
          toggleAudio={toggleAudio}
          handlePlayContent={handlePlayContent}
          handleInfoContent={handleInfoContent}
          handleToggleMyList={handleToggleMyList}
        />

        {/* Content Sections */}
        <div className="pt-4 pb-16">
          {showAllRows && (
            <>
              {/* Featured Random Content - Always First */}
              {categorizedContent.featured.length > 0 && (
                <MarqueeContentRow
                  title="Em Destaque"
                  contents={categorizedContent.featured}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  showNumbers={true}
                  hideDownloadIcon={true}
                />
              )}

              {/* Top Rated Content - Static Row */}
              {categorizedContent.topRated && categorizedContent.topRated.length > 0 && (
                <ContentRow
                  title="Mais Assistidos"
                  contents={categorizedContent.topRated}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent} // For QuickView
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                // @ts-ignore - ContentRow needs update for onDetails prop, but passing it wont hurt if ignored for now, 
                // we need to update ContentRow to pass it to Card. 
                // Better approach: verify ContentRow passes props.
                />
              )}

              {categorizedContent.movies.length > 0 && (
                <ContentRow
                  title="Filmes"
                  contents={categorizedContent.movies}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
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
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                />
              )}

              {categorizedContent.nostalgia && categorizedContent.nostalgia.length > 0 && (
                <ContentRow
                  title="Nostalgia"
                  contents={categorizedContent.nostalgia}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                />
              )}

              {categorizedContent.actionAdventure && categorizedContent.actionAdventure.length > 0 && (
                <ContentRow
                  title="Ação e Aventura"
                  contents={categorizedContent.actionAdventure}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                />
              )}

              {categorizedContent.comedyHorror && categorizedContent.comedyHorror.length > 0 && (
                <ContentRow
                  title="Comédia e Terror"
                  contents={categorizedContent.comedyHorror}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                />
              )}

              {categorizedContent.tvChannels.length > 0 && (
                <ContentRow
                  title="TV ao Vivo"
                  contents={categorizedContent.tvChannels}
                  onPlayContent={handlePlayContent}
                  onInfoContent={handleInfoContent}
                  onDetailsContent={handleDetailsContent}
                  onDownloadContent={handleDownloadContent}
                  hideDownloadIcon={true}
                />
              )}
            </>
          )}

          {showSingleRow && (
            <MarqueeContentRow
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

        <Footer />

        {/* Episode Selector Modal */}
        {selectedSeries && (
          <EpisodeSelector
            open={!!selectedSeries}
            onClose={() => setSelectedSeries(null)}
            episodes={selectedSeries.episodes || []}
            title={selectedSeries.title}
            trailerUrl={selectedSeries.trailer_url}
            onPlayEpisode={(url, episodeTitle) => {
              const foundEp = selectedSeries.episodes?.find(e => e.url === url);
              if (foundEp) {
                const watchUrl = `/watch/${selectedSeries.id}?season=${foundEp.season}&episode=${foundEp.episode}`;

                if (selectedSeries.is_cinema_mode) {
                  setPendingPlayerState({
                    contentId: selectedSeries.id,
                    season: foundEp.season,
                    episode: foundEp.episode
                  });
                  setShowCinemaModal(true);
                } else {
                  navigate(watchUrl);
                }
              }
            }}
          />
        )}

        {/* Main Player Modal */}
        <ContentPlayerModal
          open={playerModal.open}
          onClose={() => setPlayerModal({ open: false, url: '', title: '', isPremium: false })}
          videoUrl={playerModal.url}
          videoUrls={playerModal.urls}
          title={playerModal.title}
          isPremium={playerModal.isPremium}
          image={playerModal.image}
          description={playerModal.description}
          rating={playerModal.rating}
          episodeTitle={playerModal.episodeTitle}
          internalPlayerUrl={playerModal.internalUrl}
          suggestions={randomContent}
          nextEpisode={playerModal.nextEpisode}
          isLastEpisode={selectedSeries?.category === 'series' && !playerModal.nextEpisode}
          onPlayNext={() => {
            if (playerModal.nextEpisode && selectedSeries) {
              const playerState = {
                open: true,
                url: playerModal.nextEpisode.url,
                title: selectedSeries.title,
                isPremium: selectedSeries.isPremium,
                image: selectedSeries.thumbnail_url,
                description: selectedSeries.description,
                rating: selectedSeries.rating,
                episodeTitle: `T${playerModal.nextEpisode.season}E${playerModal.nextEpisode.episode} - ${playerModal.nextEpisode.title}`,
                nextEpisode: getNextEpisode(selectedSeries, playerModal.nextEpisode.season, playerModal.nextEpisode.episode)
              };

              setPlayerModal(playerState);
            }
          }}
          onPlayContent={(content) => {
            if (content.video_url || content.internal_player_url) {
              const playerState = {
                open: true,
                url: content.video_url || '',
                urls: content.video_urls,
                title: content.title,
                isPremium: content.isPremium,
                image: content.thumbnail_url,
                internalUrl: content.internal_player_url,
                description: content.description,
                rating: content.rating
              };

              if (content.is_cinema_mode) {
                setPendingPlayerState(playerState);
                setShowCinemaModal(true);
              } else {
                setPlayerModal(playerState);
              }
            }
          }}
          onAddToMyList={handleToggleMyList}
        />

        {/* Download Modal */}
        <DownloadModal
          open={downloadModal.open}
          onClose={() => setDownloadModal(prev => ({ ...prev, open: false }))}
          downloadUrl={downloadModal.url}
          downloads={downloadModal.downloads}
          downloadMode={downloadModal.downloadMode}
          title={downloadModal.title}
          thumbnail={downloadModal.thumbnail}
        />

        {/* Quick View Modal */}
        <QuickViewModal
          open={!!quickViewContent}
          content={quickViewContent}
          onClose={() => setQuickViewContent(null)}
          onPlay={handlePlayContent}
        />

        <CinemaWarningModal
          open={showCinemaModal}
          onClose={() => setShowCinemaModal(false)}
          onConfirm={() => {
            if (pendingPlayerState) {
              let watchUrl = '';
              if (pendingPlayerState.season && pendingPlayerState.episode) {
                // Series episode
                watchUrl = `/watch/${pendingPlayerState.contentId}?season=${pendingPlayerState.season}&episode=${pendingPlayerState.episode}`;
              } else if (pendingPlayerState.contentId) {
                // Movie
                watchUrl = `/watch/${pendingPlayerState.contentId}`;
              } else {
                // Fallback to old modal behavior for TV channels
                setPlayerModal(pendingPlayerState);
                setPendingPlayerState(null);
                setShowCinemaModal(false);
                return;
              }
              navigate(watchUrl);
              setPendingPlayerState(null);
              setShowCinemaModal(false);
            }
          }}
        />
      </div>
    );
  };

  export default Index;
