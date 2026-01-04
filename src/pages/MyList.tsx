import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ContentCard } from '@/components/ContentCard';
import { ContentPlayerModal } from '@/components/ContentPlayerModal';
import { useAuth } from '@/contexts/AuthContext';
import { getMyList, removeFromMyList, getAllContents, addToMyList } from '@/lib/firebase';
import { QuickViewModal } from '@/components/QuickViewModal';
import { toast } from 'sonner';
import { Heart, Trash2 } from 'lucide-react';
import type { MyListItem } from '@/types/user';
import type { Content } from '@/types/content';

const MyList = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [myList, setMyList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, internalUrl?: string }>({ open: false, url: '', title: '', isPremium: false });
  const [suggestions, setSuggestions] = useState<Content[]>([]);
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);


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
      const items = await getMyList(user.uid);
      setMyList(items);

      // Load suggestions (all content)
      const allContent = await getAllContents();
      // Filter out items already in my list to make suggestions more relevant
      // Or just shuffle all
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
    if (item.content.category === 'series') {
      // If we had an episode selector here, we would use it. 
      // For now, redirect to details page where they can pick an episode.
      navigate(`/content/${item.content.id}`);
    } else if (item.content.category === 'movie') {
      navigate(`/watch/${item.content.id}`);
    } else if (item.content.video_url) {
      // TV Channels or others - keep modal
      setPlayerModal({ open: true, url: item.content.video_url, urls: item.content.video_urls, title: item.content.title, isPremium: item.content.isPremium, image: item.content.thumbnail_url, description: item.content.description, rating: item.content.rating });
    } else {
      toast.error('Link de vídeo não disponível');
    }
  };

  const handleInfoContent = (item: MyListItem) => {
    setQuickViewContent(item.content);
  };

  const handleDetailsContent = (item: MyListItem) => {
    navigate(`/content/${item.content.id}`);
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
                />
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Remover da lista"
                >
                  <Trash2 className="w-3 h-3" />
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
              className="text-primary hover:underline"
            >
              Explorar conteúdo
            </button>
          </div>
        )}
      </div>

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
        internalPlayerUrl={playerModal.internalUrl}
        suggestions={suggestions}
        onPlayContent={(c) => {
          if (c.category === 'movie') {
            navigate(`/watch/${c.id}`);
          } else if (c.video_url || c.internal_player_url) {
            setPlayerModal({
              open: true,
              url: c.video_url || '',
              urls: c.video_urls,
              title: c.title,
              isPremium: c.isPremium,
              image: c.thumbnail_url,
              description: c.description,
              rating: c.rating,
              internalUrl: c.internal_player_url
            });
          }
        }}
        onAddToMyList={handleAddSuggestionToList}
      />

      {/* Quick View Modal */}
      <QuickViewModal
        open={!!quickViewContent}
        content={quickViewContent}
        onClose={() => setQuickViewContent(null)}
        onPlay={(content) => {
          // QuickViewModal internal logic now handles navigation for movies/series
          // But if it falls back here (e.g. for TV or special cases), we handle it
          if (content.category === 'series') {
            navigate(`/content/${content.id}`);
          } else if (content.category === 'movie') {
            navigate(`/watch/${content.id}`);
          } else if (content.video_url) {
            setPlayerModal({
              open: true,
              url: content.video_url,
              urls: content.video_urls,
              title: content.title,
              isPremium: content.isPremium,
              image: content.thumbnail_url,
              description: content.description,
              rating: content.rating
            });
          }
          setQuickViewContent(null);
        }}
      />
    </div>
  );
};

export default MyList;