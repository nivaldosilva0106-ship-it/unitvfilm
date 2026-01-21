import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addContent, getAllContents, deleteContent, updateContent, sendContentNotification } from "@/lib/firebase";
import type { Content } from "@/types/content";
import { AdminContentForm } from "@/components/admin/AdminContentForm";
import { AdminContentList } from "@/components/admin/AdminContentList";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminContentImporter } from "@/components/admin/AdminContentImporter";
import { useAuth } from "@/contexts/AuthContext";

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
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      loadContents();
    }
  }, [isAdmin, loading, navigate]);

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
      <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
        <div className="space-y-6 overflow-y-auto pr-2 pb-4 text-white">
          <div className="bg-secondary/20 border border-secondary/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Ferramentas de Apoio</h4>
                <p className="text-[10px] text-muted-foreground">Gerador de Links Diretos Google Drive</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={() => window.open('https://ferramentas-lake.vercel.app/', '_blank')}
            >
              Abrir Ferramentas Tools
            </Button>
          </div>

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

        <AdminContentList
          allContents={allContents}
          listSearchQuery={listSearchQuery}
          setListSearchQuery={setListSearchQuery}
          setEditingContent={setEditingContent}
          handleDelete={handleDelete}
        />
      </div>
    </AdminLayout>
  );
};

export default Admin;