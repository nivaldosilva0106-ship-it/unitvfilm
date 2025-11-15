import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { addContent, getAllContents, deleteContent, updateContent } from "@/lib/firebase";
import type { Content } from "@/types/content";
import { AdminContentForm } from "@/components/admin/AdminContentForm";
import { AdminContentList } from "@/components/admin/AdminContentList";

const Admin = () => {
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
    loadContents();
  }, []);

  const loadContents = async () => {
    try {
      const data = await getAllContents();
      setAllContents(data);
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    }
  };

  // Função auxiliar movida para Admin.tsx, pois é usada na lógica de salvamento
  const normalizeVideoUrl = (value?: string) => {
    if (!value) return value;
    const trimmed = value.trim();
    // Se for um iframe colado, extrai o src
    const match = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
    return trimmed;
  };

  const handleSave = async () => {
    if (!editingContent.title || !editingContent.category || !editingContent.thumbnail_url) {
      toast.error("Preencha os campos obrigatórios (Título, Categoria, URL da Imagem)");
      return;
    }
    
    const isTV = editingContent.category === 'tv';
    const isSeries = editingContent.category === 'series';
    const isMovie = editingContent.category === 'movie';

    // Normaliza URL de vídeo (extrai src caso seja iframe colado)
    const normalizedVideo = normalizeVideoUrl(editingContent.video_url || undefined);

    if ((isTV || isMovie) && !normalizedVideo) {
      toast.error(`Para ${isTV ? 'TV' : 'Filme'}, informe a URL do vídeo.`);
      return;
    }

    // Cria uma cópia limpa para salvar
    const contentToSave: Partial<Content> = {
      ...editingContent,
      video_url: normalizedVideo || undefined,
    };
    
    // Limpeza de campos irrelevantes
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

    // Garante que campos vazios sejam deletados para evitar problemas no Firebase
    if (!contentToSave.description) delete contentToSave.description;
    if (!contentToSave.download_url) delete contentToSave.download_url;
    if (!contentToSave.trailer_url) delete contentToSave.trailer_url;
    if (!contentToSave.language) delete contentToSave.language;
    if (!contentToSave.release_date) delete contentToSave.release_date;
    if (!contentToSave.video_url) delete contentToSave.video_url;
    if (!contentToSave.rating) delete contentToSave.rating;
    if (!contentToSave.tmdb_id) delete contentToSave.tmdb_id;


    try {
      if (editingContent.id) {
        await updateContent(editingContent.id, contentToSave);
        toast.success("Conteúdo atualizado!");
      } else {
        await addContent(contentToSave as Omit<Content, 'id'>);
        toast.success("Conteúdo adicionado!");
      }
      
      // Resetar formulário
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-8 pt-24 pb-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <Button
            onClick={() => window.location.href = '/admin/ads'}
            variant="outline"
          >
            Gerenciar Anúncios
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <AdminContentForm
            editingContent={editingContent}
            setEditingContent={setEditingContent}
            handleSave={handleSave}
          />
          
          <AdminContentList
            allContents={allContents}
            listSearchQuery={listSearchQuery}
            setListSearchQuery={setListSearchQuery}
            setEditingContent={setEditingContent}
            handleDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
};

export default Admin;