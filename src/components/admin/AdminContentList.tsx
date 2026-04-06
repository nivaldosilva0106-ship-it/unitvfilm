import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Content } from "@/types/content";

interface AdminContentListProps {
  allContents: Content[];
  listSearchQuery: string;
  setListSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setEditingContent: React.Dispatch<React.SetStateAction<Partial<Content>>>;
  handleDelete: (id: string) => Promise<void>;
}

export const AdminContentList = ({
  allContents,
  listSearchQuery,
  setListSearchQuery,
  setEditingContent,
  handleDelete,
}: AdminContentListProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "Todos" },
    { id: "movie", label: "Filmes" },
    { id: "series", label: "Séries" },
    { id: "tv", label: "TV Online" },
    { id: "nostalgia", label: "Nostalgia" },
    { id: "canais24h", label: "Canais 24h" },
  ];

  // Filtra a lista de conteúdos com base na categoria e search query
  const filteredContents = allContents.filter(content => {
    const matchesCategory = selectedCategory === "all" || content.category === selectedCategory;
    const matchesSearch = listSearchQuery.trim() === "" || 
      content.title.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
      content.category.toLowerCase().includes(listSearchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  return (
    <Card className="p-6 bg-card border-border flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-foreground">Conteúdos Cadastrados</h2>
        
        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/30 rounded-lg border border-border/50">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={`h-7 px-2.5 text-[11px] font-medium transition-all ${selectedCategory === cat.id ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou categoria..."
          value={listSearchQuery}
          onChange={(e) => setListSearchQuery(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredContents.map((content) => (
            <div key={content.id} className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary shadow-sm ring-1 ring-white/10">
              <img
                src={content.thumbnail_url || "/placeholder.svg"}
                alt={content.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Overlay Gradient with text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="font-semibold text-white text-sm line-clamp-1" title={content.title}>{content.title}</h3>
                <p className="text-xs text-gray-300 capitalize">{content.category}</p>
              </div>

              {/* Hover Actions Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingContent(content)}
                  className="h-8 px-2"
                  title="Editar"
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(content.id)}
                  className="h-8 w-8 p-0"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredContents.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            {listSearchQuery ? "Nenhum resultado encontrado para sua busca." : "Nenhum conteúdo cadastrado"}
          </p>
        )}
      </ScrollArea>
    </Card>
  );
};