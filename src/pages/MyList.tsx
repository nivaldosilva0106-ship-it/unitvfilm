import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ContentCard } from '@/components/ContentCard';
import { ContentPlayerModal } from '@/components/ContentPlayerModal';
import { useAuth } from '@/contexts/AuthContext';
import { getMyList, removeFromMyList, getAllContents, addToMyList, getSiteSettings, type SiteSettings } from '@/lib/firebase';
import { QuickViewModal } from '@/components/QuickViewModal';
import { toast } from 'sonner';
import { Heart, Trash2 } from 'lucide-react';
import { EpisodeSelector } from '@/components/EpisodeSelector';
import { CinemaWarningModal } from '@/components/CinemaWarningModal';
import type { MyListItem } from '@/types/user';
import type { Content } from '@/types/content';
import { useSpatialNavigation, FOCUSABLE_CLASS } from '@/hooks/useSpatialNavigation';

const MyList = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [myList, setMyList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, internalUrl?: string }>({ open: false, url: '', title: '', isPremium: false });
  const [suggestions, setSuggestions] = useState<Content[]>([]);
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  useSpatialNavigation({
    enabled: true,
    onBack: () => {
      if (selectedSeries) {
        setSelectedSeries(null);
      } else if (showCinemaModal) {
        setShowCinemaModal(false);
      } else if (quickViewContent) {
        setQuickViewContent(null);
      } else {
        navigate(-1);
      }
    },
    onEnter: (el) => {
      el.click();
    }
  });


  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login');
      } else {
        loadMyList();
      }
    }
  }, [user, authLoading, navigate]);

  const loadMyList = async () => {
    if (!user) return;

    try {
      const [items, settings, allContent] = await Promise.all([
        getMyList(user.uid),
        getSiteSettings(),
        getAllContents()
      ]);
      
      setMyList(items);
      setSiteSettings(settings);

      // Filter out items already in my list for suggestions
      const inListIds = items.map(i => i.contentId);
      const potentialSuggestions = allContent.filter(c => !inListIds.includes(c.id));
      setSuggestions(potentialSuggestions.sort(() => 0.5 - Math.random()).slice(0, 10));
    } catch (error) {
      toast.error('Erro ao carregar sua lista');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestionToList = async (c: Content) => {
    if (!user) return;
    try {
      const newItem = await addToMyList(user.uid, c); // Add to DB
      // Update local list state
      setMyList(prev => [...prev, newItem]);
      toast.success('Adicionado à sua lista');
      // Remove from suggestions? Optional.
      setSuggestions(prev => prev.filter(s => s.id !== c.id));
    } catch (error) {
      toast.info('Já está na sua lista');
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!user) return;

    try {
      await removeFromMyList(user.uid, itemId);
      setMyList(myList.filter(item => item.id !== itemId));
      toast.success('Removido da sua lista');
    } catch (error) {
      toast.error('Erro ao remover da lista');
    }
  };

  const handlePlayContent = (item: MyListItem) => {
    const content = item.content;
    if (content.category === 'nostalgia') {
      navigate(`/nostalgia/${content.id}`);
      return;
    }

    const isSeries = content.category?.toLowerCase() === 'series' || 
                    content.category?.toLowerCase() === 'série' || 
                    content.category?.toLowerCase() === 'serie' ||
                    (content.episodes && content.episodes.length > 0);

    if (isSeries) {
      setSelectedSeries(content);
      return;
    }

    if (content.category === 'tv') {
      navigate(`/tv?channelId=${content.id}`);
      return;
    }

    if (content.is_cinema_mode) {
      setPendingPlayerState({ ...content, contentId: content.id });
      setShowCinemaModal(true);
    } else {
      navigate(`/watch/${content.id}`);
    }
  };

  const handleInfoContent = (item: MyListItem) => {
    setQuickViewContent(item.content);
  };

  const handleDetailsContent = (item: MyListItem) => {
    handlePlayContent(item);
  };

  if (authLoading || loading) {
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

      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-16">
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 flex items-center justify-center sm:justify-start gap-3">
            <Heart className="w-8 h-8 text-primary fill-primary" />
            Minha Lista
          </h1>
          <p className="text-muted-foreground">
            {myList.length} {myList.length === 1 ? 'item' : 'itens'} na sua lista
          </p>
        </div>

        {myList.length > 0 ? (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {myList.map((item) => (
              <div key={item.id} className="relative group">
                 <ContentCard
                  title={item.content.title}
                  thumbnail={item.content.thumbnail_url}
                  onPlay={() => handlePlayContent(item)}
                  onInfo={() => handleInfoContent(item)}
                  onDetails={() => handleDetailsContent(item)}
                  isPremium={item.content.isPremium}
                  classification={item.content.classification}
                  watch_provider={item.content.watch_provider}
                  providerLogos={siteSettings?.providerLogos}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                  className={`absolute top-2 right-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground p-2 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 shadow-lg ${FOCUSABLE_CLASS}`}
                  tabIndex={0}
                  title="Remover da lista"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground mb-4">
              Sua lista está vazia
            </p>
            <p className="text-muted-foreground mb-8">
              Adicione filmes e séries à sua lista para assistir depois
            </p>
            <button
              onClick={() => navigate('/')}
              className={`text-primary hover:underline ${FOCUSABLE_CLASS}`}
              tabIndex={0}
            >
              Explorar conteúdo
            </button>
          </div>
        )}
      </div>

      {selectedSeries && (
        <EpisodeSelector
          open={!!selectedSeries}
          onClose={() => setSelectedSeries(null)}
          episodes={selectedSeries.episodes || []}
          title={selectedSeries.title}
          trailerUrl={selectedSeries.trailer_url}
          thumbnail={selectedSeries.thumbnail_url}
          onPlayEpisode={(ep) => {
            const watchUrl = `/watch/${selectedSeries.id}?season=${ep.season}&episode=${ep.episode}`;
            if (selectedSeries.is_cinema_mode) {
              setPendingPlayerState({ contentId: selectedSeries.id, season: ep.season, episode: ep.episode });
              setShowCinemaModal(true);
            } else {
              navigate(watchUrl);
            }
          }}
        />
      )}

      <CinemaWarningModal
        open={showCinemaModal}
        onClose={() => setShowCinemaModal(false)}
        onConfirm={() => {
          if (pendingPlayerState) {
            let watchUrl = '';
            if (pendingPlayerState.season && pendingPlayerState.episode) {
              watchUrl = `/watch/${pendingPlayerState.contentId}?season=${pendingPlayerState.season}&episode=${pendingPlayerState.episode}`;
            } else if (pendingPlayerState.contentId) {
              watchUrl = `/watch/${pendingPlayerState.contentId}`;
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

export default MyList;