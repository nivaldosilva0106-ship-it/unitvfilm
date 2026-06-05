import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addContent, getAllContents, deleteContent, updateContent, sendContentNotification, getSiteSettings } from "@/lib/firebase";
import type { Content } from "@/types/content";
import type { QuickAccessCard } from "@/lib/firebase";
import { AdminContentForm } from "@/components/admin/AdminContentForm";
import { AdminContentList } from "@/components/admin/AdminContentList";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminContentImporter } from "@/components/admin/AdminContentImporter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink } from "lucide-react";
import { syncContentToExternal } from "@/lib/external-api";

interface AdminContentFormProps {
  editingContent: Partial<Content>;
  setEditingContent: React.Dispatch<React.SetStateAction<Partial<Content>>>;
  handleSave: (sendNotification?: boolean) => Promise<void>;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [allContents, setAllContents] = useState<Content[]>([]);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [quickAccessCards, setQuickAccessCards] = useState<QuickAccessCard[]>([]);

  const [editingContent, setEditingContent] = useState<Partial<Content>>({
    title: "",
    category: "movie",
    description: "",
    thumbnail_url: "",
    video_url: "",
    episodes: [],
    download_url: "",
    trailer_url: "",
    language: "pt-BR",
    release_date: "",
    isPremium: false,
    external_sync_enabled: false,
    external_source_url: "",
    is_cinema_mode: false,
    adBlockFriendly: false,
    tag_portugal: false,
    tag_brasil: false,
    tag_dublado: false,
    tag_legenda: false,
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      loadContents();
      loadQuickAccessCards();
    }
  }, [isAdmin, loading, navigate]);

  const loadQuickAccessCards = async () => {
    try {
      const settings = await getSiteSettings();
      setQuickAccessCards(settings.quickAccessCards || []);
    } catch (error) {
      console.error("Erro ao carregar cards de acesso rápido:", error);
    }
  };

  const loadContents = async () => {
    try {
      const data = await getAllContents();
      setAllContents(data);
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    }
  };

  const normalizeVideoUrl = (value?: string) => {
    if (!value) return value;
    const trimmed = value.trim();
    const match = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
    return trimmed;
  };

  const handleSave = async (sendNotification = false) => {
    if (!editingContent.title || !editingContent.category || !editingContent.thumbnail_url) {
      toast.error("Preencha os campos obrigatórios (Título, Categoria, URL da Imagem)");
      return;
    }

    const isTV = editingContent.category === 'tv';
    const isSeries = editingContent.category === 'series';
    const isMovie = editingContent.category === 'movie';

    const normalizedVideo = normalizeVideoUrl(editingContent.video_url || undefined);
    const hasInternalPlayer = !!editingContent.internal_player_url;

    // Allow saving with internal_player_url OR video_url for movies/tv
    if ((isTV || isMovie) && !normalizedVideo && !hasInternalPlayer) {
      toast.error(`Para ${isTV ? 'TV' : 'Filme'}, informe a URL do vídeo ou do Player Interno.`);
      return;
    }

    const contentToSave: Partial<Content> = {
      ...editingContent,
      video_url: normalizedVideo || undefined,
    };

    if (isMovie) {
      delete contentToSave.episodes;
    } else if (isTV) {
      delete contentToSave.episodes;
      delete contentToSave.download_url;
      delete contentToSave.trailer_url;
    } else if (isSeries) {
      delete contentToSave.download_url;
      delete contentToSave.video_url;
    }

    if (!contentToSave.description) delete contentToSave.description;
    if (!contentToSave.download_url) delete contentToSave.download_url;
    if (!contentToSave.trailer_url) delete contentToSave.trailer_url;
    if (!contentToSave.language) delete contentToSave.language;
    if (!contentToSave.release_date) delete contentToSave.release_date;
    if (!contentToSave.video_url) delete contentToSave.video_url;
    if (!contentToSave.rating) delete contentToSave.rating;
    if (!contentToSave.tmdb_id) delete contentToSave.tmdb_id;

    try {
      let contentId: string;

      if (editingContent.id) {
        await updateContent(editingContent.id, contentToSave);
        contentId = editingContent.id;
        toast.success("Conteúdo atualizado!");
      } else {
        const newContent = await addContent(contentToSave as Omit<Content, 'id'>);
        contentId = newContent.id;
        toast.success("Conteúdo adicionado!");
      }

      // Send notification if requested
      if (sendNotification && contentToSave.title && contentToSave.category) {
        try {
          await sendContentNotification(
            contentId,
            contentToSave.title,
            contentToSave.category,
            contentToSave.thumbnail_url
          );
          toast.success("Notificação enviada aos usuários!");
        } catch (error) {
          console.error("Error sending notification:", error);
          toast.error("Conteúdo salvo, mas erro ao enviar notificação");
        }
      }

      // External Sync Logic
      if (editingContent.external_sync_enabled && editingContent.external_source_url) {
        try {
          // Mapeamento de Tipos
          const externalTypeMap: Record<string, "movie" | "series" | "tv"> = {
            'movie': 'movie',
            'series': 'series',
            'tv': 'tv',
            'nostalgia': 'movie',
            'canais24h': 'tv'
          };

          // Mapeamento de Nomes de Categorias (Fallback se não houver gênero)
          const categoryNameMap: Record<string, string> = {
            'movie': 'Filmes',
            'series': 'Séries',
            'tv': 'TV',
            'nostalgia': 'Nostalgia',
            'canais24h': 'Canais 24h'
          };

          // Determinar o nome da categoria (Gênero ou fallback)
          const categoriaNome = (contentToSave.genre && contentToSave.genre.length > 0)
            ? contentToSave.genre[0]
            : categoryNameMap[contentToSave.category] || 'Filmes';

          await syncContentToExternal({
            tipo: externalTypeMap[contentToSave.category] || 'movie',
            nome_link: contentToSave.title || "",
            link_link: editingContent.external_source_url,
            logo: contentToSave.thumbnail_url,
            categoria: categoriaNome, // Enviando o NOME da categoria/gênero
            tmdb_id: contentToSave.tmdb_id?.toString(),
            ano: contentToSave.year,
            trailer_url: contentToSave.trailer_url,
            provedor_streaming: contentToSave.watch_provider,
          });
          toast.success("Conteúdo sincronizado com UniTvIPTV!");
        } catch (error) {
          console.error("External Sync Error:", error);
          toast.error("Erro na sincronização externa");
        }
      }

      setEditingContent({
        title: "",
        category: "movie",
        description: "",
        thumbnail_url: "",
        video_url: "",
        episodes: [],
        download_url: "",
        trailer_url: "",
        language: "pt-BR",
        release_date: "",
        isPremium: false,
        is_cinema_mode: false,
        adBlockFriendly: false,
        tag_portugal: false,
        tag_brasil: false,
        tag_dublado: false,
        tag_legenda: false,
      });
      loadContents();
    } catch (error) {
      console.error("Firebase Save Error:", error);
      toast.error("Erro ao salvar conteúdo. Verifique o console para detalhes.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id);
      toast.success("Conteúdo removido!");
      loadContents();
    } catch (error) {
      toast.error("Erro ao remover conteúdo");
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Gerenciar Conteúdos">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout title="Gerenciar Conteúdos">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 h-[calc(100vh-64px)] overflow-hidden">
        <div className="space-y-4 overflow-y-auto p-4 pt-4 lg:pl-6 text-white custom-scrollbar flex flex-col">
          {quickAccessCards.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x custom-scrollbar flex-shrink-0">
              {quickAccessCards.map((card) => (
                <div 
                  key={card.id} 
                  className="bg-secondary/20 border border-secondary/30 rounded-xl p-4 flex items-center justify-between min-w-[280px] md:min-w-[320px] max-w-[350px] snap-start flex-shrink-0 gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {card.imageUrl ? (
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <img 
                          src={card.imageUrl} 
                          alt={card.title} 
                          className="w-10 h-10 rounded-lg object-cover border border-white/10" 
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const fallback = (e.target as HTMLElement).nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 absolute inset-0">
                          <Settings className="w-5 h-5" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                        <Settings className="w-5 h-5" />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-sm truncate text-white">{card.title}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">{card.description || 'Acesso rápido'}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-shrink-0"
                    onClick={() => window.open(card.url, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Abrir
                  </Button>
                </div>
              ))}
            </div>
          )}

          <AdminContentImporter
            onImport={(importedData) => {
              setEditingContent(prev => ({ ...prev, ...importedData }));
            }}
          />
          <AdminContentForm
            editingContent={editingContent}
            setEditingContent={setEditingContent}
            handleSave={handleSave}
          />
        </div>

        <div className="p-2 pt-4 h-full overflow-hidden pr-4">
          <AdminContentList
            allContents={allContents}
            listSearchQuery={listSearchQuery}
            setListSearchQuery={setListSearchQuery}
            setEditingContent={setEditingContent}
            handleDelete={handleDelete}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default Admin;