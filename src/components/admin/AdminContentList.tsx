import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  
  // Filtra a lista de conteúdos com base na query de busca
  const filteredContents = allContents.filter(content => {
    if (listSearchQuery.trim() === "") return true;
    const lowerCaseQuery = listSearchQuery.toLowerCase();
    return (
      content.title.toLowerCase().includes(lowerCaseQuery) ||
      content.category.toLowerCase().includes(lowerCaseQuery)
    );
  });

  return (
    <Card className="p-6 bg-card border-border">
      <h2 className="text-xl font-semibold text-foreground mb-4">Conteúdos Cadastrados</h2>
      
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou categoria..."
          value={listSearchQuery}
          onChange={(e) => setListSearchQuery(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {filteredContents.map((content) => (
          <div key={content.id} className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
            <img 
              src={content.thumbnail_url || "/placeholder.svg"} 
              alt={content.title}
              className="w-16 h-20 object-cover rounded"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{content.title}</h3>
              <p className="text-sm text-muted-foreground capitalize">{content.category}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingContent(content)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(content.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {filteredContents.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {listSearchQuery ? "Nenhum resultado encontrado para sua busca." : "Nenhum conteúdo cadastrado"}
          </p>
        )}
      </div>
    </Card>
  );
};