import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { addAd, getAllAds, updateAd, deleteAd } from "@/lib/firebase";
import type { Ad } from "@/types/ad";
import { Plus, Save, Trash2, Edit } from "lucide-react";

const AdminAds = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [editingAd, setEditingAd] = useState<Partial<Ad>>({
    name: "",
    code: "",
    placement: "content-top",
    active: true,
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      loadAds();
    }
  }, [isAdmin, loading, navigate]);

  const loadAds = async () => {
    try {
      const data = await getAllAds();
      setAds(data);
    } catch (error) {
      toast.error("Erro ao carregar anúncios");
    }
  };

  const handleSave = async () => {
    if (!editingAd.name || !editingAd.code || !editingAd.placement) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      if (editingAd.id) {
        await updateAd(editingAd.id, editingAd);
        toast.success("Anúncio atualizado!");
      } else {
        await addAd({
          ...editingAd,
          createdAt: new Date().toISOString(),
        } as Omit<Ad, 'id'>);
        toast.success("Anúncio adicionado!");
      }
      
      setEditingAd({
        name: "",
        code: "",
        placement: "content-top",
        active: true,
      });
      loadAds();
    } catch (error) {
      toast.error("Erro ao salvar anúncio");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este anúncio?")) return;
    
    try {
      await deleteAd(id);
      toast.success("Anúncio removido!");
      loadAds();
    } catch (error) {
      toast.error("Erro ao remover anúncio");
    }
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-8 pt-24 pb-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Gerenciar Anúncios</h1>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {editingAd.id ? "Editar Anúncio" : "Novo Anúncio"}
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="ad-name">Nome do Anúncio *</Label>
                <Input
                  id="ad-name"
                  value={editingAd.name || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })}
                  placeholder="Ex: Google AdSense Header"
                />
              </div>

              <div>
                <Label htmlFor="ad-placement">Posição *</Label>
                <Select
                  value={editingAd.placement}
                  onValueChange={(value) => setEditingAd({ ...editingAd, placement: value as Ad['placement'] })}
                >
                  <SelectTrigger id="ad-placement">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Cabeçalho</SelectItem>
                    <SelectItem value="footer">Rodapé</SelectItem>
                    <SelectItem value="sidebar">Barra Lateral</SelectItem>
                    <SelectItem value="content-top">Topo do Conteúdo</SelectItem>
                    <SelectItem value="content-bottom">Final do Conteúdo</SelectItem>
                    <SelectItem value="player">Player de Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ad-code">Código do Anúncio (HTML/Script) *</Label>
                <Textarea
                  id="ad-code"
                  value={editingAd.code || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, code: e.target.value })}
                  placeholder='<script async src="https://pagead2.googlesyndication.com/..."></script>'
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cole aqui o código fornecido pelo Google AdSense, AdMob ou outra plataforma
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="ad-active"
                  checked={editingAd.active ?? true}
                  onCheckedChange={(checked) => setEditingAd({ ...editingAd, active: checked })}
                />
                <Label htmlFor="ad-active">Anúncio Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {editingAd.id ? "Atualizar" : "Adicionar"}
                </Button>
                {editingAd.id && (
                  <Button
                    variant="outline"
                    onClick={() => setEditingAd({
                      name: "",
                      code: "",
                      placement: "content-top",
                      active: true,
                    })}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Lista de Anúncios */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Anúncios Cadastrados ({ads.length})
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {ads.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum anúncio cadastrado ainda
                </p>
              ) : (
                ads.map((ad) => (
                  <Card key={ad.id} className="p-4 bg-background/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{ad.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            ad.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {ad.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Posição: <span className="font-medium">{
                            ad.placement === 'header' ? 'Cabeçalho' :
                            ad.placement === 'footer' ? 'Rodapé' :
                            ad.placement === 'sidebar' ? 'Barra Lateral' :
                            ad.placement === 'content-top' ? 'Topo do Conteúdo' :
                            ad.placement === 'content-bottom' ? 'Final do Conteúdo' :
                            'Player de Vídeo'
                          }</span>
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver código
                          </summary>
                          <pre className="mt-2 p-2 bg-black/20 rounded overflow-x-auto">
                            <code>{ad.code}</code>
                          </pre>
                        </details>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(ad)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(ad.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAds;
