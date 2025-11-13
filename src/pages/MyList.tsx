import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ContentCard } from '@/components/ContentCard';
import { ContentPlayerModal } from '@/components/ContentPlayerModal';
import { useAuth } from '@/contexts/AuthContext';
import { getMyList, removeFromMyList } from '@/lib/firebase';
import { toast } from 'sonner';
import { Heart, Trash2 } from 'lucide-react';
import type { MyListItem } from '@/types/user';

const MyList = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [myList, setMyList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, title: string }>({ open: false, url: '', title: '' });


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
    } catch (error) {
      toast.error('Erro ao carregar sua lista');
    } finally {
      setLoading(false);
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
    if (item.content.video_url) {
      setPlayerModal({ open: true, url: item.content.video_url, title: item.content.title });
    } else if (item.content.category === 'series' && item.content.episodes && item.content.episodes.length > 0) {
      // Se for série, redireciona para a página de detalhes para abrir o seletor de episódios
      navigate(`/content/${item.content.id}`);
    } else {
      toast.error('Link de vídeo não disponível');
    }
  };

  const handleInfoContent = (item: MyListItem) => {
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
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-primary fill-primary" />
            Minha Lista
          </h1>
          <p className="text-muted-foreground">
            {myList.length} {myList.length === 1 ? 'item' : 'itens'} na sua lista
          </p>
        </div>

        {myList.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {myList.map((item) => (
              <div key={item.id} className="relative group">
                <ContentCard
                  title={item.content.title}
                  thumbnail={item.content.thumbnail_url}
                  onPlay={() => handlePlayContent(item)}
                  onInfo={() => handleInfoContent(item)}
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
        onClose={() => setPlayerModal({ open: false, url: '', title: '' })}
        videoUrl={playerModal.url}
        title={playerModal.title}
      />
    </div>
  );
};

export default MyList;